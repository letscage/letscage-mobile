package com.letscage_mobile.app

object BackgroundServiceNative {
    init {
        System.loadLibrary("letscage_mobile_lib") // Replace with your library name
    }

    @JvmStatic
    external fun invokeRustBackgroundTask(configPath: String): Int
}