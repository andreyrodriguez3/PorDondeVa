package com.tubus.driver.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

private const val PERIODIC_SYNC_WORK_NAME = "location-sync-periodic"
private const val IMMEDIATE_SYNC_WORK_NAME = "location-sync-immediate"

/**
 * Two schedules, two jobs. The immediate one-time request is what actually delivers
 * points during an active trip: LocationEngine triggers it after every fix, with a
 * short initial delay so a burst of fixes coalesces into one batch rather than one
 * request each (network-constrained, exponential backoff from 10s per README.md).
 * The 15-minute periodic request is WorkManager's floor — not useful for live
 * delivery, but a safety net that drains the queue even if the app process was killed
 * and the immediate request never got scheduled.
 */
@Singleton
class SyncScheduler @Inject constructor(@ApplicationContext private val context: Context) {

    fun triggerImmediateSync() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .setInitialDelay(2, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(IMMEDIATE_SYNC_WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }

    fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_SYNC_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun cancel() {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_SYNC_WORK_NAME)
        WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_SYNC_WORK_NAME)
    }
}
