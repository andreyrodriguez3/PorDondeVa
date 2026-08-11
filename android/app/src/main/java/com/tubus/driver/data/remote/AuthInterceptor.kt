package com.tubus.driver.data.remote

import com.tubus.driver.data.secure.TokenStore
import javax.inject.Inject
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor @Inject constructor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenStore.accessToken
        val request = chain.request().let {
            if (token != null) it.newBuilder().addHeader("Authorization", "Bearer $token").build() else it
        }
        return chain.proceed(request)
    }
}
