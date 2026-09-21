package com.rupeeflow.mobile.finance

import android.Manifest
import android.content.Intent
import android.content.ComponentName
import android.content.pm.PackageManager
import android.provider.Settings
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.util.concurrent.Executors

/** Async bridge. All database and SMS-provider work runs off the UI thread. */
class FinanceModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  override fun getName() = "FinanceCapture"
  @ReactMethod fun status(promise: Promise) {
    val prefs = FinanceStore.preferences(context)
    val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
    val component = ComponentName(context, FinanceNotificationListener::class.java)
    val notificationAccess = enabled.split(":").any { ComponentName.unflattenFromString(it) == component }
    promise.resolve(Arguments.createMap().apply {
      putBoolean("smsPermission", context.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED)
      putBoolean("receivePermission", context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED)
      putBoolean("smsEnabled", prefs.getBoolean("sms", false))
      putBoolean("notificationsEnabled", prefs.getBoolean("notifications", false))
      putBoolean("notificationAccess", notificationAccess)
    })
  }
  @ReactMethod fun setEnabled(kind: String, enabled: Boolean, promise: Promise) {
    if (kind !in setOf("sms", "notifications")) { promise.reject("INVALID", "Unknown capture source"); return }
    FinanceStore.preferences(context).edit().putBoolean(kind, enabled).commit()
    if (kind == "notifications" && enabled) NotificationListenerService.requestRebind(ComponentName(context, FinanceNotificationListener::class.java))
    promise.resolve(null)
  }
  @ReactMethod fun openNotificationSettings(promise: Promise) {
    try {
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("SETTINGS", "Cannot open notification access settings", e) }
  }
  @ReactMethod fun openAppSettings(promise: Promise) {
    context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    promise.resolve(null)
  }
  @ReactMethod fun openPaymentApp(name: String, promise: Promise) {
    val packageName = when (name) { "Google Pay" -> "com.google.android.apps.nbu.paisa.user"; "Paytm" -> "net.one97.paytm"; else -> null }
    val intent = packageName?.let { context.packageManager.getLaunchIntentForPackage(it) }
    if (intent == null) { promise.reject("NOT_INSTALLED", "$name is not installed"); return }
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); promise.resolve(null)
  }
  @ReactMethod fun scanSms(since: Double, promise: Promise) {
    executor.execute {
      try {
        if (!FinanceStore.preferences(context).getBoolean("sms", false)) { promise.resolve(0); return@execute }
        if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
          promise.reject("PERMISSION", "SMS access is not granted"); return@execute
        }
        val store = FinanceStore.get(context)
        var added = 0
        context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, arrayOf("address", "body", "date"), "date >= ?", arrayOf(since.toLong().toString()), "date ASC")?.use { cursor ->
          val db = store.writableDatabase
          db.beginTransaction()
          try {
            while (cursor.moveToNext()) {
              if (store.record("sms", cursor.getString(0) ?: "Unknown", cursor.getString(1) ?: "", cursor.getLong(2))) added++
            }
            db.setTransactionSuccessful()
          } finally { db.endTransaction() }
        }
        promise.resolve(added)
      } catch (e: Exception) { promise.reject("SMS_READ", "Could not read SMS inbox", e) }
    }
  }
  @ReactMethod fun events(after: Double, promise: Promise) {
    executor.execute {
      try {
        val result = Arguments.createArray()
        FinanceStore.get(context).readableDatabase.rawQuery("SELECT seq,event_id,source,sender,body,at FROM events WHERE seq > ? ORDER BY seq LIMIT 200", arrayOf(after.toLong().toString())).use { c ->
          while (c.moveToNext()) result.pushMap(Arguments.createMap().apply {
            putDouble("seq", c.getLong(0).toDouble()); putString("id", c.getString(1)); putString("source", c.getString(2))
            putString("sender", c.getString(3)); putString("body", c.getString(4)); putDouble("at", c.getLong(5).toDouble())
          })
        }
        promise.resolve(result)
      } catch (e: Exception) { promise.reject("INBOX_READ", "Cannot read the private inbox", e) }
    }
  }
}

class FinancePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(FinanceModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
