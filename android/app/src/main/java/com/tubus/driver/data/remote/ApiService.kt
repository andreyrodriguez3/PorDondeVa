package com.tubus.driver.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @POST("auth/driver/login")
    suspend fun login(@Body body: DriverLoginRequest): LoginResponse

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): LoginResponse

    @GET("driver/assignment")
    suspend fun assignment(): DriverAssignmentResponse

    /** Wrapped in [Response] because Retrofit's suspend-nullable-body detection is
     * unreliable for a 204 (no active trip) — see TripRepository.getActiveTrip. */
    @GET("driver/trips/active")
    suspend fun activeTrip(): Response<TripDto>

    @POST("driver/trips")
    suspend fun startTrip(@Body body: StartTripRequest): TripDto

    @POST("driver/trips/{id}/end")
    suspend fun endTrip(@Path("id") tripId: String)

    @POST("driver/trips/{id}/incidents")
    suspend fun reportIncident(
        @Path("id") tripId: String,
        @Body body: ReportIncidentRequest,
    ): IncidentResponse

    @POST("driver/trips/{id}/locations")
    suspend fun submitLocations(
        @Path("id") tripId: String,
        @Body body: SubmitLocationsRequest,
    ): SubmitLocationsResponse
}
