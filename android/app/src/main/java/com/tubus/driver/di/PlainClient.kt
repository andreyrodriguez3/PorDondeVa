package com.tubus.driver.di

import javax.inject.Qualifier

/**
 * Marks the bare OkHttpClient used only for TokenAuthenticator's own refresh call —
 * distinct from the app's authenticated client, which is itself built with this
 * authenticator attached. Without a qualifier, Dagger sees two unqualified
 * `OkHttpClient` bindings and reports both a duplicate-binding error and a dependency
 * cycle (the authenticated client depends on the authenticator, which depended on
 * "an OkHttpClient" ambiguously).
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class PlainClient
