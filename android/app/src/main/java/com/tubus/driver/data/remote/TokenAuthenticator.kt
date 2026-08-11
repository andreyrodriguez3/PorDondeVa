package com.tubus.driver.data.remote

import com.tubus.driver.BuildConfig
import com.tubus.driver.data.secure.TokenStore
import com.tubus.driver.di.PlainClient
import javax.inject.Inject
import javax.inject.Provider
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route

/**
 * Transparently refreshes on 401 and replays the request (README.md — "How the driver
 * app talks to the backend"). Uses a bare OkHttpClient rather than the app's Retrofit
 * instance to avoid a circular dependency between the authenticator and the client it
 * authenticates for.
 */
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val baseUrlProvider: Provider<String>,
    @PlainClient private val plainClient: OkHttpClient,
) : Authenticator {
    private val json = Json { ignoreUnknownKeys = true }

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null // already retried once — give up
        val refreshToken = tokenStore.refreshToken ?: return null

        val body = json.encodeToString(RefreshRequest.serializer(), RefreshRequest(refreshToken))
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("${baseUrlProvider.get()}auth/refresh")
            .header("X-Tenant-Host", BuildConfig.ADMIN_HOST)
            .post(body)
            .build()

        val refreshResponse = plainClient.newCall(request).execute()
        if (!refreshResponse.isSuccessful) {
            tokenStore.clear()
            return null
        }

        val parsed = json.decodeFromString(
            LoginResponse.serializer(),
            refreshResponse.body?.string() ?: return null,
        )
        tokenStore.accessToken = parsed.tokens.accessToken
        tokenStore.refreshToken = parsed.tokens.refreshToken

        return response.request.newBuilder()
            .header("Authorization", "Bearer ${parsed.tokens.accessToken}")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
