package com.tubus.driver.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.tubus.driver.R
import com.tubus.driver.TubusDriverApp
import com.tubus.driver.data.secure.TokenStore
import com.tubus.driver.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Android 12+ forbids starting a location foreground service from a boot receiver
 * (README.md §7.1). The honest response: ask the driver to reopen the app rather than
 * pretend tracking resumed silently.
 */
@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var tokenStore: TokenStore

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!tokenStore.tripActive) return

        val openAppIntent = Intent(context, MainActivity::class.java)
        val pendingIntent = android.app.PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, TubusDriverApp.TRACKING_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(context.getString(R.string.tracking_notification_title))
            .setContentText("El dispositivo se reinició. Abre la app para reanudar el rastreo.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context).notify(BOOT_NOTIFICATION_ID, notification)
    }

    companion object {
        private const val BOOT_NOTIFICATION_ID = 2001
    }
}
