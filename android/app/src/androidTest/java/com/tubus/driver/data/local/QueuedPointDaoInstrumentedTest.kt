package com.tubus.driver.data.local

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Runs the real Room/SQLite implementation on a device (SPECS.md §9.3 — "Room tested
 * in-memory"), rather than the hand-written fake LocationRepositoryTest uses — this is
 * what catches a real query or conflict-strategy bug the fake can't.
 */
@RunWith(AndroidJUnit4::class)
class QueuedPointDaoInstrumentedTest {
    private lateinit var db: AppDatabase
    private lateinit var dao: QueuedPointDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = db.queuedPointDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun point(clientPointId: String, ts: Long) = QueuedPointEntity(
        tripId = "trip-1",
        clientPointId = clientPointId,
        latitude = 9.9,
        longitude = -84.0,
        accuracyM = 5f,
        speedMps = 10f,
        bearingDeg = 90f,
        deviceTimestampEpochMs = ts,
    )

    @Test
    fun oldestBatchIsOrderedByDeviceTimestampNotInsertOrder() = runBlocking {
        dao.insert(point("c", ts = 300))
        dao.insert(point("a", ts = 100))
        dao.insert(point("b", ts = 200))

        val batch = dao.oldestBatch()

        assertEquals(listOf("a", "b", "c"), batch.map { it.clientPointId })
    }

    @Test
    fun insertingTheSameClientPointIdTwiceIsANoOp() = runBlocking {
        dao.insert(point("dup", ts = 1))
        dao.insert(point("dup", ts = 1))

        assertEquals(1, dao.count())
    }

    @Test
    fun deleteByClientPointIdsOnlyRemovesTheNamedRows() = runBlocking {
        dao.insert(point("keep", ts = 1))
        dao.insert(point("remove", ts = 2))

        dao.deleteByClientPointIds(listOf("remove"))

        assertEquals(listOf("keep"), dao.oldestBatch().map { it.clientPointId })
    }

    @Test
    fun evictOldestRemovesExactlyTheOldestNRows() = runBlocking {
        dao.insert(point("a", ts = 1))
        dao.insert(point("b", ts = 2))
        dao.insert(point("c", ts = 3))

        dao.evictOldest(2)

        assertEquals(listOf("c"), dao.oldestBatch().map { it.clientPointId })
    }
}
