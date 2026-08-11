package com.tubus.driver.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.tubus.driver.data.repo.LocationRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Drains the queue in chronological batches while the network is available (README.md
 * "Offline behavior"). WorkManager retries with exponential backoff (configured on the
 * work request itself) and re-runs are safe: `submitLocations` is idempotent per
 * `clientPointId` on the server, so replaying a partially-sent batch is a no-op.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val locationRepository: LocationRepository,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            // Drain fully: each flushOnce() call uploads at most one batch (≤200 points).
            while (locationRepository.flushOnce()) {
                // keep going until the queue reports empty
            }
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
