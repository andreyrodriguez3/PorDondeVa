package com.tubus.driver.data.remote

import com.tubus.driver.BuildConfig
import com.tubus.driver.data.secure.TokenStore
import javax.inject.Inject
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor @Inject constructor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenStore.accessToken
        val builder = chain.request().newBuilder().header("X-Tenant-Host", BuildConfig.ADMIN_HOST)
        if (token != null) builder.addHeader("Authorization", "Bearer $token")
        return chain.proceed(builder.build())
    }
}
