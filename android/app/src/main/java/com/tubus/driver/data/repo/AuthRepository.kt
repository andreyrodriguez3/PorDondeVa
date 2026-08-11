package com.tubus.driver.data.repo

import com.tubus.driver.data.remote.ApiService
import com.tubus.driver.data.remote.DriverLoginRequest
import com.tubus.driver.data.secure.TokenStore
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
) {
    val isLoggedIn: Boolean get() = tokenStore.isLoggedIn()

    suspend fun login(companyCode: String, username: String, password: String) {
        val response = api.login(DriverLoginRequest(companyCode, username, password))
        tokenStore.accessToken = response.tokens.accessToken
        tokenStore.refreshToken = response.tokens.refreshToken
        tokenStore.companyCode = companyCode
    }

    fun logout() {
        tokenStore.clear()
    }
}
