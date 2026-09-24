package com.arun.one.alarm

import android.app.*
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat

class WakeAlarmService : Service() {
  companion object { const val START="START"; const val STOP="STOP"; const val SNOOZE="SNOOZE"; const val CHANNEL="wake_up_alarms" }
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private var tts: TextToSpeech? = null
  private var id = "alarm"
  private var label = "Wake-up alarm"

  override fun onBind(intent: Intent?) = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      STOP -> { WakeAlarmHistory.add(this,intent.getStringExtra("id") ?: id,intent.getStringExtra("label") ?: label,"Stopped"); stopAlarm(); return START_NOT_STICKY }
      SNOOZE -> { val alarmId=intent.getStringExtra("id") ?: id;val alarmLabel=intent.getStringExtra("label") ?: label;WakeAlarmHistory.add(this,alarmId,alarmLabel,"Snoozed");WakeAlarmScheduler.snooze(this,alarmId,alarmLabel); stopAlarm(); return START_NOT_STICKY }
    }
    id = intent?.getStringExtra("id") ?: id; label = intent?.getStringExtra("label") ?: label
    createChannel(); startForeground(7001, notification()); startRinging()
    val prefs=getSharedPreferences("wake_alarm_preferences",0)
    handler.postDelayed({stopAlarm()},prefs.getInt("maxMinutes",20).coerceIn(1,60)*60_000L)
    if(prefs.getBoolean("voice",false))tts=TextToSpeech(this){if(it==TextToSpeech.SUCCESS)tts?.speak(label,TextToSpeech.QUEUE_FLUSH,null,"alarm-label")}
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
        setDataSource(this@WakeAlarmService, uri); isLooping = true; prepare(); if(getSharedPreferences("wake_alarm_preferences",0).getBoolean("gradual",true))setVolume(.12f,.12f); start()
      }
      if(getSharedPreferences("wake_alarm_preferences",0).getBoolean("gradual",true))for(step in 1..8)handler.postDelayed({val volume=(.12f+step*.11f).coerceAtMost(1f);player?.setVolume(volume,volume)},step*4000L)
    } catch (_: Exception) {
      player?.release(); player = null
    }
    vibrator = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java).defaultVibrator else @Suppress("DEPRECATION") (getSystemService(VIBRATOR_SERVICE) as Vibrator)
    val pattern = longArrayOf(0, 700, 300, 700, 600)
    if(getSharedPreferences("wake_alarm_preferences",0).getBoolean("vibrate",true))if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) else @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0)
  }

  private fun stopAlarm() { handler.removeCallbacksAndMessages(null);player?.stop(); player?.release(); player=null; vibrator?.cancel();tts?.stop();tts?.shutdown();tts=null; stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
  override fun onDestroy() { handler.removeCallbacksAndMessages(null);player?.release(); player=null; vibrator?.cancel();tts?.shutdown();tts=null; super.onDestroy() }
}
