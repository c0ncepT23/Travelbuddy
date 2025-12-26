package com.travelagent.app

import android.content.Intent
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    
    // Handle share intent when app is launched
    handleShareIntent(intent)
  }
  
  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    // Handle share intent when app is already running
    intent?.let { 
      handleShareIntent(it)
      
      // Notify JS module immediately if it's a share intent
      val action = it.action
      val type = it.type
      if (Intent.ACTION_SEND == action && type != null && type.startsWith("text/")) {
        val sharedText = it.getStringExtra(Intent.EXTRA_TEXT)
        if (!sharedText.isNullOrEmpty()) {
          val urlPattern = "(https?://[^\\s]+)".toRegex()
          val matchResult = urlPattern.find(sharedText)
          val url = matchResult?.value ?: sharedText
          
          // Emit event to JS
          reactInstanceManager.currentReactContext?.let { context ->
            val module = context.getNativeModule(ShareIntentModule::class.java)
            module?.sendEvent(url)
          }
        }
      }
    }
  }
  
  private fun handleShareIntent(intent: Intent) {
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
          
          // Store the URL so the JS module can retrieve it
          ShareIntentModule.setSharedUrl(url)
        }
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
