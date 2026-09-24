package com.arun.one.core

import android.app.*
import android.content.*
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.hardware.biometrics.BiometricPrompt
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.util.Base64
import com.arun.one.MainActivity
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.security.SecureRandom
import java.util.concurrent.Executor
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class OneCoreModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), ActivityEventListener {
  companion object { const val AUTH_REQUEST = 2402 }
  private var authPromise: Promise? = null
  init { context.addActivityEventListener(this) }
  override fun getName() = "OneCore"

  @ReactMethod fun deviceStatus(promise: Promise) {
    val power = context.getSystemService(PowerManager::class.java)
    val keyguard = context.getSystemService(KeyguardManager::class.java)
    promise.resolve(Arguments.createMap().apply {
      putBoolean("batteryExempt", power.isIgnoringBatteryOptimizations(context.packageName))
      putBoolean("deviceSecure", keyguard.isDeviceSecure)
    })
  }

  @ReactMethod fun openSettings(kind: String, promise: Promise) {
    try {
      val intent = when (kind) {
        "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        "security" -> Intent(Settings.ACTION_SECURITY_SETTINGS)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent); promise.resolve(null)
    } catch (e: Exception) { promise.reject("SETTINGS", "Could not open Android settings.", e) }
  }

  @ReactMethod fun authenticate(reason: String, promise: Promise) {
    val activity = context.currentActivity ?: return promise.reject("AUTH", "Open Arun One and try again.")
    val keyguard = context.getSystemService(KeyguardManager::class.java)
    if (!keyguard.isDeviceSecure) return promise.reject("AUTH", "Set a phone PIN, pattern, fingerprint or face lock first.")
    if (Build.VERSION.SDK_INT >= 30) {
      val signal = CancellationSignal(); val executor = Executor { activity.runOnUiThread(it) }
      BiometricPrompt.Builder(activity).setTitle("Unlock Arun One").setSubtitle(reason)
        .setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG or android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL)
        .build().authenticate(signal, executor, object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { promise.resolve(true) }
          override fun onAuthenticationError(code: Int, message: CharSequence) { promise.reject("AUTH", message.toString()) }
        })
    } else {
      val intent = keyguard.createConfirmDeviceCredentialIntent("Unlock Arun One", reason) ?: return promise.reject("AUTH", "Device authentication is unavailable.")
      authPromise = promise; activity.startActivityForResult(intent, AUTH_REQUEST)
    }
  }

  @ReactMethod fun encrypt(value: String, password: String, promise: Promise) = crypto(promise) {
    val salt=ByteArray(16).also(SecureRandom()::nextBytes); val iv=ByteArray(12).also(SecureRandom()::nextBytes)
    val cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key(password,salt),GCMParameterSpec(128,iv))
    "AONE2.${b64(salt)}.${b64(iv)}.${b64(cipher.doFinal(value.toByteArray(Charsets.UTF_8)))}"
  }
  @ReactMethod fun decrypt(value: String, password: String, promise: Promise) = crypto(promise) {
    val parts=value.trim().split('.'); require(parts.size==4&&parts[0]=="AONE2") { "Invalid Arun One backup" }
    val salt=unb64(parts[1]); val iv=unb64(parts[2]); val cipher=Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE,key(password,salt),GCMParameterSpec(128,iv)); String(cipher.doFinal(unb64(parts[3])),Charsets.UTF_8)
  }
  private fun key(password:String,salt:ByteArray):SecretKeySpec {
    val algorithm=if(Build.VERSION.SDK_INT>=26)"PBKDF2WithHmacSHA256" else "PBKDF2WithHmacSHA1"
    val bytes=SecretKeyFactory.getInstance(algorithm).generateSecret(PBEKeySpec(password.toCharArray(),salt,120_000,256)).encoded
    return SecretKeySpec(bytes,"AES")
  }
  private fun b64(v:ByteArray)=Base64.encodeToString(v,Base64.NO_WRAP)
  private fun unb64(v:String)=Base64.decode(v,Base64.NO_WRAP)
  private fun crypto(promise:Promise,block:()->String){try{promise.resolve(block())}catch(e:Exception){promise.reject("CRYPTO","Wrong password or damaged backup.",e)}}

  @ReactMethod fun updateWidget(task:String,alarm:String,balance:String,promise:Promise){
    try { OneWidgetProvider.saveAndUpdate(context,task,alarm,balance); promise.resolve(null) }
    catch(e:Exception){promise.reject("WIDGET","Could not update widget.",e)}
  }

  @ReactMethod fun updateShortcuts(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= 25) {
        val manager=context.getSystemService(ShortcutManager::class.java)
        fun shortcut(id:String,label:String,uri:String,icon:Int)=ShortcutInfo.Builder(context,id).setShortLabel(label).setLongLabel(label)
          .setIcon(Icon.createWithResource(context,icon)).setIntent(Intent(Intent.ACTION_VIEW,Uri.parse(uri),context,MainActivity::class.java)).build()
        manager.dynamicShortcuts=listOf(
          shortcut("task","New task","arunone://plan/task",android.R.drawable.ic_input_add),
          shortcut("alarm","Set alarm","arunone://plan/alarm",android.R.drawable.ic_lock_idle_alarm),
          shortcut("expense","Add expense","arunone://money/expense",android.R.drawable.ic_menu_edit),
          shortcut("music","Play music","arunone://media/music",android.R.drawable.ic_media_play)
        )
      }; promise.resolve(null)
    } catch(e:Exception){promise.reject("SHORTCUTS","Could not publish shortcuts.",e)}
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if(requestCode==AUTH_REQUEST){authPromise?.resolve(resultCode==Activity.RESULT_OK);authPromise=null}
  }
  override fun onNewIntent(intent: Intent) = Unit
}

class OneCorePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(OneCoreModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
