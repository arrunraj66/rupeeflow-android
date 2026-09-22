package com.arun.one.alarm

import android.app.*
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.*
import android.provider.Settings
import androidx.core.app.NotificationCompat

class WakeAlarmService : Service() {
  companion object { const val START="START"; const val STOP="STOP"; const val SNOOZE="SNOOZE"; const val CHANNEL="wake_up_alarms" }
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var id = "alarm"
  private var label = "Wake-up alarm"

  override fun onBind(intent: Intent?) = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      STOP -> { stopAlarm(); return START_NOT_STICKY }
      SNOOZE -> { WakeAlarmScheduler.snooze(this, intent.getStringExtra("id") ?: id, intent.getStringExtra("label") ?: label); stopAlarm(); return START_NOT_STICKY }
    }
    id = intent?.getStringExtra("id") ?: id; label = intent?.getStringExtra("label") ?: label
    createChannel(); startForeground(7001, notification()); startRinging()
    return START_NOT_STICKY
  }

  private fun notification(): Notification {
    val full = PendingIntent.getActivity(this, 7002, Intent(this, WakeAlarmActivity::class.java).putExtra("id", id).putExtra("label", label), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun action(name: String, code: Int) = PendingIntent.getService(this, code, Intent(this, WakeAlarmService::class.java).setAction(name).putExtra("id", id).putExtra("label", label), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return NotificationCompat.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(label)
      .setContentText("Wake-up alarm is ringing").setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_ALARM)
      .setOngoing(true).setAutoCancel(false).setFullScreenIntent(full, true).setContentIntent(full)
      .addAction(0, "Snooze 5 min", action(SNOOZE, 7003)).addAction(0, "Stop", action(STOP, 7004)).build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL, "Wake-up alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Full-screen alarms that ring until stopped"; lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setSound(null, null); enableVibration(false)
      })
  }

  private fun startRinging() {
    if (player != null) return
    try {
      val uri: Uri = Settings.System.DEFAULT_ALARM_ALERT_URI ?: Settings.System.DEFAULT_NOTIFICATION_URI
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(this@WakeAlarmService, uri); isLooping = true; prepare(); start()
      }
    } catch (_: Exception) {
      player?.release(); player = null
    }
    vibrator = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java).defaultVibrator else @Suppress("DEPRECATION") (getSystemService(VIBRATOR_SERVICE) as Vibrator)
    val pattern = longArrayOf(0, 700, 300, 700, 600)
    if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) else @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0)
  }

  private fun stopAlarm() { player?.stop(); player?.release(); player=null; vibrator?.cancel(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
  override fun onDestroy() { player?.release(); player=null; vibrator?.cancel(); super.onDestroy() }
}
