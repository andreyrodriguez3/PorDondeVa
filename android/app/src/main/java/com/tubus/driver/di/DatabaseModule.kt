package com.tubus.driver.di

import android.content.Context
import androidx.room.Room
import com.tubus.driver.data.local.AppDatabase
import com.tubus.driver.data.local.QueuedPointDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "tubus-driver.db").build()

    @Provides
    fun provideQueuedPointDao(db: AppDatabase): QueuedPointDao = db.queuedPointDao()
}
