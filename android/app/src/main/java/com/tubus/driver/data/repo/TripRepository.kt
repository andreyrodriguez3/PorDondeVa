package com.tubus.driver.data.repo

import com.tubus.driver.data.remote.ApiService
import com.tubus.driver.data.remote.DriverAssignmentResponse
import com.tubus.driver.data.remote.StartTripRequest
import com.tubus.driver.data.remote.TripDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TripRepository @Inject constructor(private val api: ApiService) {
    suspend fun getAssignment(): DriverAssignmentResponse = api.assignment()

    /** Recovers an in-progress trip after a crash or restart (README.md). */
    suspend fun getActiveTrip(): TripDto? = api.activeTrip()

    suspend fun startTrip(routeVariantId: String, busId: String?): TripDto =
        api.startTrip(StartTripRequest(routeVariantId, busId))

    suspend fun endTrip(tripId: String) {
        api.endTrip(tripId)
    }
}
