package com.tubus.driver.data.secure

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Access and refresh tokens, plus the company code entered once at first launch
 * (README.md — the driver app has no company-bearing hostname, so the company code is
 * how it carries its tenant context).
 */
@Singleton
class TokenStore @Inject constructor(@ApplicationContext context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "tubus_driver_secure_prefs",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS, null)
        set(value) = prefs.edit().putString(KEY_ACCESS, value).apply()

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH, null)
        set(value) = prefs.edit().putString(KEY_REFRESH, value).apply()

    var companyCode: String?
        get() = prefs.getString(KEY_COMPANY_CODE, null)
        set(value) = prefs.edit().putString(KEY_COMPANY_CODE, value).apply()

    /**
     * Set while TrackingService is running, cleared on a normal stop. Read by
     * BootReceiver, which cannot restart a location foreground service itself
     * (Android 12+ forbids it) — it can only tell the driver a trip needs resuming.
     */
    var tripActive: Boolean
        get() = prefs.getBoolean(KEY_TRIP_ACTIVE, false)
        set(value) = prefs.edit().putBoolean(KEY_TRIP_ACTIVE, value).apply()

    fun clear() {
        prefs.edit().remove(KEY_ACCESS).remove(KEY_REFRESH).apply()
    }

    fun isLoggedIn(): Boolean = accessToken != null

    companion object {
        private const val KEY_ACCESS = "access_token"
        private const val KEY_REFRESH = "refresh_token"
        private const val KEY_COMPANY_CODE = "company_code"
        private const val KEY_TRIP_ACTIVE = "trip_active"
    }
}
