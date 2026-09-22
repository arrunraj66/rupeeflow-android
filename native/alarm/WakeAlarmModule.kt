package com.arun.one.alarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray

class WakeAlarmModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "WakeAlarm"

  @ReactMethod fun schedule(id: String, label: String, hour: Int, minute: Int, days: ReadableArray, promise: Promise) {
    try {
      val values = JSONArray()
      for (i in 0 until days.size()) values.put(days.getInt(i))
      val trigger = WakeAlarmScheduler.saveAndSchedule(context, WakeAlarmSpec(id, label, hour, minute, values))
      promise.resolve(trigger.toDouble())
    } catch (e: SecurityException) {
      promise.reject("EXACT_ALARM_ACCESS", "Allow Alarms & reminders for Arun One, then try again.", e)
    } catch (e: Exception) { promise.reject("ALARM_SCHEDULE", "Could not set the wake-up alarm.", e) }
  }

  @ReactMethod fun cancel(id: String, promise: Promise) {
    try { WakeAlarmScheduler.cancel(context, id); promise.resolve(null) }
    catch (e: Exception) { promise.reject("ALARM_CANCEL", "Could not cancel the alarm.", e) }
  }

  @ReactMethod fun status(promise: Promise) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    val notifications = Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
    val fullScreen = Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
    promise.resolve(Arguments.createMap().apply {
      putBoolean("exact", exact); putBoolean("notifications", notifications); putBoolean("fullScreen", fullScreen)
    })
  }

  @ReactMethod fun openSettings(kind: String, promise: Promise) {
    try {
      val action = if (kind == "fullScreen" && Build.VERSION.SDK_INT >= 34) Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
        else Settings.ACTION_APPLICATION_DETAILS_SETTINGS
      context.startActivity(Intent(action, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("ALARM_SETTINGS", "Could not open alarm settings.", e) }
  }

  @ReactMethod fun test(promise: Promise) {
    try {
      WakeAlarmScheduler.scheduleTest(context, "alarm-test", "Wake-up alarm test", System.currentTimeMillis() + 5000)
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("ALARM_TEST", "Could not start alarm test.", e) }
  }
}

class WakeAlarmPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(WakeAlarmModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
