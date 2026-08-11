package com.tubus.driver.location

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.tubus.driver.data.repo.LocationRepository
import com.tubus.driver.sync.SyncScheduler
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val INTERVAL_MS = 5_000L
private const val MIN_INTERVAL_MS = 3_000L
private const val MIN_DISPLACEMENT_M = 10f

/**
 * Wraps FusedLocationProviderClient with the fixed cadence and displacement filter from
 * SPECS.md §8 / README.md §7.1. Every fix is written to Room before anything else — GPS
 * acquisition and network transport are independent concerns (§9).
 */
@Singleton
class LocationEngine @Inject constructor(
    @ApplicationContext private val context: Context,
    private val locationRepository: LocationRepository,
    private val syncScheduler: SyncScheduler,
) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var activeTripId: String? = null

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val tripId = activeTripId ?: return
            for (location in result.locations) {
                scope.launch {
                    locationRepository.enqueue(
                        tripId = tripId,
                        latitude = location.latitude,
                        longitude = location.longitude,
                        accuracyM = if (location.hasAccuracy()) location.accuracy else null,
                        speedMps = if (location.hasSpeed()) location.speed else null,
                        bearingDeg = if (location.hasBearing()) location.bearing else null,
                        deviceTimestampEpochMs = location.time,
                    )
                    syncScheduler.triggerImmediateSync()
                }
            }
        }
    }

    @SuppressLint("MissingPermission") // Caller (TrackingService) only starts after the
    // permission and location-services checks in PermissionCoordinator have passed.
    fun start(tripId: String) {
        activeTripId = tripId
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_DISPLACEMENT_M)
            .build()
        fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
    }

    fun stop() {
        activeTripId = null
        fusedClient.removeLocationUpdates(callback)
    }
}
