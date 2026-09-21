package com.rupeeflow.mobile.finance

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.Executors

/** Only finance-app notifications are retained; no OTPs, chat notifications, or screen scraping. */
class FinanceNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!FinanceStore.preferences(this).getBoolean("notifications", false)) return
    if (sbn.packageName !in supportedApps) return
    val notification = sbn.notification
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    val extras = notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val detail = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
      ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
    val body = "$title $detail".trim()
    executor.execute { FinanceStore.get(this).record("notification", sbn.packageName, body, sbn.postTime) }
  }
  override fun onListenerConnected() {
    // Android provides only currently active notifications, not historical dismissed ones.
    activeNotifications?.forEach { onNotificationPosted(it) }
  }
  companion object {
    private val executor = Executors.newSingleThreadExecutor()
    val supportedApps = setOf("com.phonepe.app", "com.google.android.apps.nbu.paisa.user", "net.one97.paytm", "in.org.npci.upiapp",
      "com.snapwork.hdfc", "com.csam.icici.bank.imobile", "com.sbi.lotusintouch", "com.axis.mobile", "com.msf.kbank.mobile",
      "com.canarabank.mobility", "com.idfcfirstbank.optimus", "com.federalbank.fedmobile")
  }
}
