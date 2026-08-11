package com.tubus.driver.location

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.tubus.driver.R
import com.tubus.driver.TubusDriverApp
import com.tubus.driver.data.secure.TokenStore
import com.tubus.driver.sync.SyncScheduler
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Foreground service of type `location`, started only while an activity is visible
 * (README.md §7.1) — this app never requests ACCESS_BACKGROUND_LOCATION. The
 * persistent notification is the "clearly indicate when tracking is active" requirement
 * from SPECS.md §7.
 */
@AndroidEntryPoint
class TrackingService : Service() {

    @Inject lateinit var locationEngine: LocationEngine
    @Inject lateinit var syncScheduler: SyncScheduler
    @Inject lateinit var tokenStore: TokenStore

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val tripId = intent?.getStringExtra(EXTRA_TRIP_ID)
        if (tripId == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        locationEngine.start(tripId)
        syncScheduler.schedulePeriodicSync()
        tokenStore.tripActive = true
        return START_STICKY
    }

    override fun onDestroy() {
        locationEngine.stop()
        tokenStore.tripActive = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, TubusDriverApp.TRACKING_CHANNEL_ID)
            .setContentTitle(getString(R.string.tracking_notification_title))
            .setContentText(getString(R.string.tracking_notification_text))
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()

    companion object {
        const val EXTRA_TRIP_ID = "trip_id"
        private const val NOTIFICATION_ID = 1001

        fun startIntent(context: android.content.Context, tripId: String) =
            Intent(context, TrackingService::class.java).putExtra(EXTRA_TRIP_ID, tripId)
    }
}
