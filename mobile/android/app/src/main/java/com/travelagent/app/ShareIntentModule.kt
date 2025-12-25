package com.travelagent.app

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule

class ShareIntentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private var sharedUrl: String? = null
        
        fun setSharedUrl(url: String?) {
            sharedUrl = url
        }
        
        fun getStoredSharedUrl(): String? {
            return sharedUrl
        }
    }
    
    override fun getName(): String {
        return "ShareIntentModule"
    }
    
    @ReactMethod
    fun getSharedUrl(promise: Promise) {
        try {
            val activity = currentActivity
            if (activity != null) {
                val intent = activity.intent
                val action = intent.action
                val type = intent.type
                
                if (Intent.ACTION_SEND == action && type != null) {
                    if (type.startsWith("text/")) {
                        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                        if (!sharedText.isNullOrEmpty()) {
                            // Extract URL from the shared text
                            val urlPattern = "(https?://[^\\s]+)".toRegex()
                            val matchResult = urlPattern.find(sharedText)
                            val url = matchResult?.value ?: sharedText
                            promise.resolve(url)
                            return
                        }
                    }
                }
                
                // Check if we have a stored URL from when app was launched
                if (sharedUrl != null) {
                    promise.resolve(sharedUrl)
                    return
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun clearSharedUrl() {
        sharedUrl = null
        currentActivity?.intent?.let { intent ->
            intent.action = null
            intent.type = null
            intent.removeExtra(Intent.EXTRA_TEXT)
        }
    }
    
    fun sendEvent(url: String) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onShareIntent", url)
    }
    
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }
    
    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }
}

