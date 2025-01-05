package com.letscage_mobile.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

class BackgroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "BackgroundServiceChannel",
                "Background Service",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)

            val notification = Notification.Builder(this, "BackgroundServiceChannel")
                .setContentTitle("Background Task Running")
                .setContentText("Your app is performing tasks in the background.")
                .setSmallIcon(android.R.drawable.ic_menu_info_details)
                .build()

            startForeground(1, notification)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Get config path from intent extras
        val configPath = intent?.getStringExtra("config_path") ?: ""
        
        // Start foreground notification
        //createNotificationChannel()
        //startForeground(NOTIFICATION_ID, createNotification())
        
        // Invoke Rust with config path
        BackgroundServiceNative.invokeRustBackgroundTask(configPath)
        
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}