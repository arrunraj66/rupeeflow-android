package com.arun.one.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

data class WakeAlarmSpec(val id: String, val label: String, val hour: Int, val minute: Int, val days: JSONArray)

object WakeAlarmScheduler {
  private const val PREFS = "arun_one_wake_alarms"

  fun saveAndSchedule(context: Context, spec: WakeAlarmSpec): Long {
    val all = readAll(context); all.put(spec.id, encode(spec)); writeAll(context, all)
    return schedule(context, spec)
  }

  fun cancel(context: Context, id: String) {
    context.getSystemService(AlarmManager::class.java).cancel(pending(context, id, "", false))
    val all = readAll(context); all.remove(id); writeAll(context, all)
  }

  fun rescheduleAll(context: Context) {
    val all = readAll(context)
    for (key in all.keys()) decode(all.getJSONObject(key))?.let { schedule(context, it) }
  }

  fun onFired(context: Context, id: String) {
    val all = readAll(context); val spec = all.optJSONObject(id)?.let(::decode) ?: return
    if (spec.days.length() == 0) { all.remove(id); writeAll(context, all) } else schedule(context, spec)
  }

  fun scheduleTest(context: Context, id: String, label: String, at: Long) {
    set(context, at, pendingAt(context, id, label, true))
  }

  fun snooze(context: Context, id: String, label: String) {
    set(context, System.currentTimeMillis() + 5 * 60_000L, pendingAt(context, "$id-snooze", label, true))
  }

  fun skipNext(context: Context, id: String): Long {
    val spec = readAll(context).optJSONObject(id)?.let(::decode) ?: throw IllegalArgumentException("Alarm not found")
    context.getSystemService(AlarmManager::class.java).cancel(pending(context, id, "", false))
    val skipped = next(spec, System.currentTimeMillis())
    val at = next(spec, skipped + 1000)
    set(context, at, pending(context, spec.id, spec.label, false)); return at
  }

  private fun schedule(context: Context, spec: WakeAlarmSpec): Long {
    val at = next(spec, System.currentTimeMillis())
    set(context, at, pending(context, spec.id, spec.label, false))
    return at
  }

  private fun set(context: Context, at: Long, operation: PendingIntent) {
    val alarm = context.getSystemService(AlarmManager::class.java)
    val show = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 991, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    alarm.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), operation)
  }

  private fun pending(context: Context, id: String, label: String, snooze: Boolean) = pendingAt(context, id, label, snooze)
  private fun pendingAt(context: Context, id: String, label: String, snooze: Boolean): PendingIntent {
    val intent = Intent(context, WakeAlarmReceiver::class.java).setAction("com.arun.one.WAKE_ALARM")
      .putExtra("id", id).putExtra("label", label).putExtra("snooze", snooze)
    return PendingIntent.getBroadcast(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun next(spec: WakeAlarmSpec, after: Long): Long {
    val now = Calendar.getInstance().apply { timeInMillis = after }
    for (offset in 0..7) {
      val candidate = Calendar.getInstance().apply {
        timeInMillis = after
        add(Calendar.DAY_OF_YEAR, offset); set(Calendar.HOUR_OF_DAY, spec.hour); set(Calendar.MINUTE, spec.minute)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      }
      val allowed = spec.days.length() == 0 || (0 until spec.days.length()).any { spec.days.getInt(it) == candidate.get(Calendar.DAY_OF_WEEK) - 1 }
      if (allowed && candidate.timeInMillis > now.timeInMillis + 1000) return candidate.timeInMillis
    }
    throw IllegalStateException("No future alarm occurrence")
  }

  private fun encode(s: WakeAlarmSpec) = JSONObject().put("id", s.id).put("label", s.label).put("hour", s.hour).put("minute", s.minute).put("days", s.days)
  private fun decode(o: JSONObject): WakeAlarmSpec? = try { WakeAlarmSpec(o.getString("id"), o.optString("label", "Wake-up alarm"), o.getInt("hour"), o.getInt("minute"), o.optJSONArray("days") ?: JSONArray()) } catch (_: Exception) { null }
  private fun readAll(context: Context) = try { JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("alarms", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
  private fun writeAll(context: Context, value: JSONObject) { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("alarms", value.toString()).commit() }
}

object WakeAlarmHistory {
  private const val PREFS="arun_one_wake_alarm_history"
  fun add(context:Context,id:String,label:String,event:String){val prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);val history=try{JSONArray(prefs.getString("items","[]"))}catch(_:Exception){JSONArray()};val next=JSONArray().put(JSONObject().put("id",id).put("label",label).put("event",event).put("at",System.currentTimeMillis()));for(i in 0 until minOf(history.length(),49))next.put(history.get(i));prefs.edit().putString("items",next.toString()).apply()}
  fun read(context:Context)=try{JSONArray(context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString("items","[]"))}catch(_:Exception){JSONArray()}
  fun clear(context:Context){context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().clear().apply()}
}
