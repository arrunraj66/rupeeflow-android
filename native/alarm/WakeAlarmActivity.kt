package com.arun.one.alarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.*

class WakeAlarmActivity : Activity() {
  private var id = "alarm"; private var label = "Wake-up alarm"
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    setShowWhenLocked(true); setTurnScreenOn(true); window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON)
    id=intent.getStringExtra("id") ?: id; label=intent.getStringExtra("label") ?: label
    val pad=(28*resources.displayMetrics.density).toInt()
    val layout=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; gravity=Gravity.CENTER; setPadding(pad,pad,pad,pad); setBackgroundColor(Color.rgb(8,14,29)) }
    layout.addView(TextView(this).apply { text="ARUN ONE • WAKE-UP ALARM"; setTextColor(Color.rgb(101,222,235)); textSize=14f; gravity=Gravity.CENTER })
    layout.addView(TextView(this).apply { text=label; setTextColor(Color.WHITE); textSize=36f; gravity=Gravity.CENTER; setPadding(0,pad,0,pad*2) })
    layout.addView(Button(this).apply { text="SNOOZE 5 MIN"; setOnClickListener { command(WakeAlarmService.SNOOZE) } }, LinearLayout.LayoutParams(-1,(58*resources.displayMetrics.density).toInt()).apply { bottomMargin=pad/2 })
    layout.addView(Button(this).apply { text="STOP ALARM"; setOnClickListener { command(WakeAlarmService.STOP) } }, LinearLayout.LayoutParams(-1,(58*resources.displayMetrics.density).toInt()))
    setContentView(layout)
  }
  private fun command(action: String) { startService(Intent(this, WakeAlarmService::class.java).setAction(action).putExtra("id",id).putExtra("label",label)); finishAndRemoveTask() }
  override fun onBackPressed() { /* Require Stop or Snooze so the alarm cannot be dismissed accidentally. */ }
}
