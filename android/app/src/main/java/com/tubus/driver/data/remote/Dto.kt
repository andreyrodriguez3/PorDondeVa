package com.tubus.driver.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DriverLoginRequest(
    val companyCode: String,
    val username: String,
    val password: String,
)

@Serializable
data class AuthTokensDto(val accessToken: String, val refreshToken: String)

@Serializable
data class AuthenticatedUserDto(
    val id: String,
    val companyId: String?,
    val role: String,
    val name: String,
    val email: String?,
    val username: String?,
    val mustChangePassword: Boolean,
)

@Serializable
data class LoginResponse(val tokens: AuthTokensDto, val user: AuthenticatedUserDto)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class BusSummaryDto(val id: String, val label: String)

@Serializable
data class RouteAssignmentDto(
    val routeId: String,
    val routeName: String,
    val routeSlug: String,
    val variantId: String,
    val variantName: String,
    val headsign: String,
)

@Serializable
data class DriverAssignmentResponse(
    val defaultBusId: String?,
    val buses: List<BusSummaryDto>,
    val routes: List<RouteAssignmentDto>,
)

@Serializable
data class StartTripRequest(val routeVariantId: String, val busId: String? = null)

@Serializable
data class TripDto(
    val id: String,
    val routeId: String,
    val routeVariantId: String,
    val busId: String,
    val driverUserId: String,
    val status: String,
    val startedAt: String,
    val endedAt: String?,
    val rejectedPointCount: Int,
)

@Serializable
data class LocationPointDto(
    val clientPointId: String,
    val lat: Double,
    val lng: Double,
    val accuracyM: Float? = null,
    val speedMps: Float? = null,
    val bearingDeg: Float? = null,
    val deviceTimestamp: String,
)

@Serializable
data class SubmitLocationsRequest(val points: List<LocationPointDto>)

@Serializable
data class PointResultDto(val clientPointId: String, val outcome: String, val reason: String? = null)

@Serializable
data class SubmitLocationsResponse(val results: List<PointResultDto>)

@Serializable
data class ApiErrorEnvelope(val error: ApiErrorBody)

@Serializable
data class ApiErrorBody(val code: String, val message: String, @SerialName("details") val details: String? = null)
