package com.tubus.driver.data.remote

import com.tubus.driver.data.secure.TokenStore
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import javax.inject.Provider
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * SPECS.md §9.3 — "token refresh on 401". Runs the real OkHttp Authenticator against a
 * MockWebServer standing in for the API, so the request it builds (method, path, body)
 * is verified for real rather than assumed.
 */
class TokenAuthenticatorTest {
    private lateinit var server: MockWebServer
    private lateinit var tokenStore: TokenStore
    private lateinit var authenticator: TokenAuthenticator

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        tokenStore = mockk(relaxed = true)
        every { tokenStore.refreshToken } returns "old-refresh-token"

        val baseUrlProvider = Provider { server.url("/").toString() }
        authenticator = TokenAuthenticator(tokenStore, baseUrlProvider, OkHttpClient())
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun unauthorizedResponse(prior: Response? = null): Response {
        val request = Request.Builder()
            .url(server.url("/driver/trips/active"))
            .header("Authorization", "Bearer expired-access-token")
            .build()
        return Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .apply { if (prior != null) priorResponse(prior) }
            .build()
    }

    @Test
    fun `refreshes the token and replays the request with the new access token`() {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{"tokens":{"accessToken":"new-access","refreshToken":"new-refresh"},
                   |"user":{"id":"u1","companyId":"c1","role":"DRIVER","name":"D",
                   |"email":null,"username":"d1","mustChangePassword":false}}"""
                    .trimMargin(),
            ),
        )

        val result = authenticator.authenticate(null, unauthorizedResponse())

        assertEquals("Bearer new-access", result?.header("Authorization"))
        verify { tokenStore.accessToken = "new-access" }
        verify { tokenStore.refreshToken = "new-refresh" }

        val refreshCall = server.takeRequest()
        assertEquals("/auth/refresh", refreshCall.path)
        assertEquals("POST", refreshCall.method)
    }

    @Test
    fun `clears the session and gives up when the refresh call itself is rejected`() {
        server.enqueue(MockResponse().setResponseCode(401))

        val result = authenticator.authenticate(null, unauthorizedResponse())

        assertNull(result)
        verify { tokenStore.clear() }
    }

    @Test
    fun `gives up without retrying a second time to avoid an infinite loop`() {
        val firstFailure = unauthorizedResponse()
        val secondFailure = unauthorizedResponse(prior = firstFailure)

        val result = authenticator.authenticate(null, secondFailure)

        assertNull(result)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `gives up immediately when there is no refresh token to use`() {
        every { tokenStore.refreshToken } returns null

        val result = authenticator.authenticate(null, unauthorizedResponse())

        assertNull(result)
        assertEquals(0, server.requestCount)
    }
}
