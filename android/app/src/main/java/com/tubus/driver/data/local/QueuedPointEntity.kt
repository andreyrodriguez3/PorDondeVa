package com.tubus.driver.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One GPS fix waiting to be uploaded. Written before any network attempt (README.md
 * "Offline behavior") — nothing is lost to a dropped request or a killed process.
 */
@Entity(tableName = "queued_points")
data class QueuedPointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: String,
    val clientPointId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Float?,
    val speedMps: Float?,
    val bearingDeg: Float?,
    val deviceTimestampEpochMs: Long,
)
