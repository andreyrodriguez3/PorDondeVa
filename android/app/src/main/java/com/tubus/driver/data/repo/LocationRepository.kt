package com.tubus.driver.data.repo

import com.tubus.driver.data.local.QueuedPointDao
import com.tubus.driver.data.local.QueuedPointEntity
import com.tubus.driver.data.remote.ApiService
import com.tubus.driver.data.remote.LocationPointDto
import com.tubus.driver.data.remote.SubmitLocationsRequest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow

private const val QUEUE_CAP = 25_000 // ~40h at one fix/6s (README.md "Offline behavior")

@Singleton
class LocationRepository @Inject constructor(
    private val dao: QueuedPointDao,
    private val api: ApiService,
) {
    fun queueDepthFlow(): Flow<Int> = dao.countFlow()

    suspend fun enqueue(
        tripId: String,
        latitude: Double,
        longitude: Double,
        accuracyM: Float?,
        speedMps: Float?,
        bearingDeg: Float?,
        deviceTimestampEpochMs: Long,
    ) {
        dao.insert(
            QueuedPointEntity(
                tripId = tripId,
                clientPointId = UUID.randomUUID().toString(),
                latitude = latitude,
                longitude = longitude,
                accuracyM = accuracyM,
                speedMps = speedMps,
                bearingDeg = bearingDeg,
                deviceTimestampEpochMs = deviceTimestampEpochMs,
            ),
        )
        val count = dao.count()
        if (count > QUEUE_CAP) dao.evictOldest(count - QUEUE_CAP)
    }

    /**
     * Uploads one batch (oldest first) and deletes only what the server confirmed
     * accepted or duplicate — a rejected point is left queued rather than silently
     * discarded (SPECS.md §9), though in steady operation rejections should be rare
     * since fixes are queued with the device's own clock.
     */
    suspend fun flushOnce(): Boolean {
        val batch = dao.oldestBatch()
        if (batch.isEmpty()) return false

        val byTrip = batch.groupBy { it.tripId }
        for ((tripId, points) in byTrip) {
            val response = api.submitLocations(
                tripId,
                SubmitLocationsRequest(points.map(::toDto)),
            )
            val confirmed = response.results
                .filter { it.outcome == "accepted" || it.outcome == "duplicate" }
                .map { it.clientPointId }
            if (confirmed.isNotEmpty()) dao.deleteByClientPointIds(confirmed)
        }
        return true
    }

    private fun toDto(point: QueuedPointEntity): LocationPointDto = LocationPointDto(
        clientPointId = point.clientPointId,
        lat = point.latitude,
        lng = point.longitude,
        accuracyM = point.accuracyM,
        speedMps = point.speedMps,
        bearingDeg = point.bearingDeg,
        deviceTimestamp = isoFormat(point.deviceTimestampEpochMs),
    )

    private fun isoFormat(epochMs: Long): String {
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        return format.format(Date(epochMs))
    }
}
