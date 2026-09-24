package com.arun.one.core

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.arun.one.MainActivity
import com.arun.one.R

class OneWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context:Context,manager:AppWidgetManager,ids:IntArray){ids.forEach{manager.updateAppWidget(it,views(context))}}
  companion object {
    private const val PREFS="arun_one_widget"
    fun saveAndUpdate(context:Context,task:String,alarm:String,balance:String){context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString("task",task).putString("alarm",alarm).putString("balance",balance).apply();val m=context.getSystemService(AppWidgetManager::class.java);val c=ComponentName(context,OneWidgetProvider::class.java);m.updateAppWidget(c,views(context))}
    private fun views(context:Context):RemoteViews{val p=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);return RemoteViews(context.packageName,R.layout.one_widget).apply{setTextViewText(R.id.widget_task,p.getString("task","Open Arun One")!!);setTextViewText(R.id.widget_alarm,p.getString("alarm","No alarm")!!);setTextViewText(R.id.widget_balance,p.getString("balance","Balance unavailable")!!);val launch=PendingIntent.getActivity(context,2403,Intent(context,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE);setOnClickPendingIntent(R.id.widget_root,launch)}}
  }
}
