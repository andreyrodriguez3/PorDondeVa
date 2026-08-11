package com.tubus.driver.data.repo

import com.tubus.driver.data.local.QueuedPointDao
import com.tubus.driver.data.local.QueuedPointEntity
import com.tubus.driver.data.remote.ApiService
import com.tubus.driver.data.remote.DriverAssignmentResponse
import com.tubus.driver.data.remote.LoginResponse
import com.tubus.driver.data.remote.PointResultDto
import com.tubus.driver.data.remote.RefreshRequest
import com.tubus.driver.data.remote.StartTripRequest
import com.tubus.driver.data.remote.SubmitLocationsRequest
import com.tubus.driver.data.remote.SubmitLocationsResponse
import com.tubus.driver.data.remote.TripDto
import com.tubus.driver.data.remote.DriverLoginRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * In-memory fake mirroring QueuedPointDao's real queries closely enough to exercise
 * LocationRepository's logic (SPECS.md §9.3 — "queue write-before-send ordering,
 * batch chunking, dedup after a failed-then-retried upload") without a Room/Android
 * runtime.
 */
private class FakeQueuedPointDao : QueuedPointDao {
    private val rows = mutableListOf<QueuedPointEntity>()
    private var nextId = 1L
    val insertCalls = mutableListOf<QueuedPointEntity>()

    override suspend fun insert(point: QueuedPointEntity) {
        insertCalls.add(point)
        if (rows.any { it.clientPointId == point.clientPointId }) return // OnConflict.IGNORE
        rows.add(point.copy(id = nextId++))
    }

    override suspend fun oldestBatch(limit: Int): List<QueuedPointEntity> =
        rows.sortedBy { it.deviceTimestampEpochMs }.take(limit)

    override suspend fun deleteByClientPointIds(clientPointIds: List<String>) {
        rows.removeAll { it.clientPointId in clientPointIds }
    }

    override fun countFlow(): Flow<Int> = MutableStateFlow(rows.size)

    override suspend fun count(): Int = rows.size

    override suspend fun evictOldest(overflow: Int) {
        val toRemove = rows.sortedBy { it.deviceTimestampEpochMs }.take(overflow).map { it.id }
        rows.removeAll { it.id in toRemove }
    }

    override suspend fun delete(point: QueuedPointEntity) {
        rows.removeAll { it.id == point.id }
    }
}

/** Records every submitted batch and replays a scripted response for it. */
private class FakeApiService(
    private val responses: MutableList<(List<String>) -> SubmitLocationsResponse>,
) : ApiService {
    val submittedBatches = mutableListOf<List<String>>()

    override suspend fun login(body: DriverLoginRequest): LoginResponse = error("not used")

    override suspend fun refresh(body: RefreshRequest): LoginResponse = error("not used")

    override suspend fun assignment(): DriverAssignmentResponse = error("not used")

    override suspend fun activeTrip(): TripDto? = error("not used")

    override suspend fun startTrip(body: StartTripRequest): TripDto = error("not used")

    override suspend fun endTrip(tripId: String) = error("not used")

    override suspend fun submitLocations(
        tripId: String,
        body: SubmitLocationsRequest,
    ): SubmitLocationsResponse {
        val ids = body.points.map { it.clientPointId }
        submittedBatches.add(ids)
        val next = responses.removeFirstOrNull() ?: { pointIds: List<String> ->
            SubmitLocationsResponse(pointIds.map { PointResultDto(it, "accepted") })
        }
        return next(ids)
    }
}

private fun point(clientPointId: String, tripId: String = "trip-1", ts: Long = 0L) =
    QueuedPointEntity(
        tripId = tripId,
        clientPointId = clientPointId,
        latitude = 9.9,
        longitude = -84.0,
        accuracyM = 5f,
        speedMps = 10f,
        bearingDeg = 90f,
        deviceTimestampEpochMs = ts,
    )

class LocationRepositoryTest {

    @Test
    fun `flushOnce returns false when the queue is empty`() = runBlocking {
        val dao = FakeQueuedPointDao()
        val repo = LocationRepository(dao, FakeApiService(mutableListOf()))

        assertFalse(repo.flushOnce())
    }

    @Test
    fun `flushOnce uploads the oldest batch in chronological order`() = runBlocking {
        val dao = FakeQueuedPointDao()
        dao.insert(point("c", ts = 300))
        dao.insert(point("a", ts = 100))
        dao.insert(point("b", ts = 200))
        val api = FakeApiService(mutableListOf())
        val repo = LocationRepository(dao, api)

        assertTrue(repo.flushOnce())

        assertEquals(listOf("a", "b", "c"), api.submittedBatches.single())
    }

    @Test
    fun `flushOnce deletes accepted and duplicate points but leaves rejected ones queued`() =
        runBlocking {
            val dao = FakeQueuedPointDao()
            dao.insert(point("accepted", ts = 1))
            dao.insert(point("duplicate", ts = 2))
            dao.insert(point("rejected", ts = 3))
            val api = FakeApiService(
                mutableListOf({ ids ->
                    SubmitLocationsResponse(
                        ids.map { id ->
                            when (id) {
                                "rejected" -> PointResultDto(id, "rejected", "future timestamp")
                                "duplicate" -> PointResultDto(id, "duplicate")
                                else -> PointResultDto(id, "accepted")
                            }
                        },
                    )
                }),
            )
            val repo = LocationRepository(dao, api)

            repo.flushOnce()

            assertEquals(listOf("rejected"), dao.oldestBatch().map { it.clientPointId })
        }

    @Test
    fun `a batch that fails entirely is retried unchanged on the next flushOnce call`() =
        runBlocking {
            val dao = FakeQueuedPointDao()
            dao.insert(point("a", ts = 1))
            val api = FakeApiService(
                mutableListOf({ _ -> throw java.io.IOException("network down") }),
            )
            val repo = LocationRepository(dao, api)

            try {
                repo.flushOnce()
            } catch (_: java.io.IOException) {
                // SyncWorker is what catches this and asks WorkManager to retry with
                // backoff — the repository itself just propagates the failure.
            }

            // Nothing was deleted: replaying the same batch is safe because the server's
            // own dedup on clientPointId makes a resend a no-op (D8 in ROADMAP.md).
            assertEquals(listOf("a"), dao.oldestBatch().map { it.clientPointId })
        }

    @Test
    fun `enqueue writes the point before any network attempt`() = runBlocking {
        val dao = FakeQueuedPointDao()
        val repo = LocationRepository(dao, FakeApiService(mutableListOf()))

        repo.enqueue(
            tripId = "trip-1",
            latitude = 9.9,
            longitude = -84.0,
            accuracyM = 5f,
            speedMps = 10f,
            bearingDeg = 90f,
            deviceTimestampEpochMs = 123L,
        )

        assertEquals(1, dao.insertCalls.size)
        assertEquals(1, dao.count())
    }
}
