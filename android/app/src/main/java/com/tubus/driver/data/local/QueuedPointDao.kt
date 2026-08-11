package com.tubus.driver.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface QueuedPointDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(point: QueuedPointEntity)

    /** Oldest-first, so an offline flush uploads in chronological order (§29 in SPECS.md). */
    @Query("SELECT * FROM queued_points ORDER BY deviceTimestampEpochMs ASC LIMIT :limit")
    suspend fun oldestBatch(limit: Int = 200): List<QueuedPointEntity>

    @Query("DELETE FROM queued_points WHERE clientPointId IN (:clientPointIds)")
    suspend fun deleteByClientPointIds(clientPointIds: List<String>)

    @Query("SELECT COUNT(*) FROM queued_points")
    fun countFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM queued_points")
    suspend fun count(): Int

    /**
     * The queue is capped at roughly 40 hours of tracking (~25,000 points at one fix
     * every 5-6s) with oldest-first eviction (README.md "Offline behavior").
     */
    @Query(
        "DELETE FROM queued_points WHERE id IN (" +
            "SELECT id FROM queued_points ORDER BY deviceTimestampEpochMs ASC LIMIT :overflow)",
    )
    suspend fun evictOldest(overflow: Int)

    @Delete
    suspend fun delete(point: QueuedPointEntity)
}
