package com.arun.one.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class WakeAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      WakeAlarmScheduler.rescheduleAll(context); return
    }
    val id = intent.getStringExtra("id") ?: "alarm"
    val label = intent.getStringExtra("label") ?: "Wake-up alarm"
    if (!intent.getBooleanExtra("snooze", false)) WakeAlarmScheduler.onFired(context, id)
    val service = Intent(context, WakeAlarmService::class.java).setAction(WakeAlarmService.START).putExtra("id", id).putExtra("label", label)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service) else context.startService(service)
  }
}
