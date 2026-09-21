package com.rupeeflow.mobile.finance

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import java.util.concurrent.Executors

/** RECEIVE_SMS runs without the JS app. Multipart segments are joined before parsing/storage. */
class FinanceSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    if (!FinanceStore.preferences(context).getBoolean("sms", false)) return
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    if (parts.isEmpty()) return
    val sender = parts[0].originatingAddress ?: "Unknown"
    val body = parts.joinToString("") { it.messageBody ?: "" }
    val at = parts[0].timestampMillis
    val pending = goAsync()
    executor.execute {
      try { FinanceStore.get(context).record("sms", sender, body, at) }
      finally { pending.finish() }
    }
  }
  companion object { private val executor = Executors.newSingleThreadExecutor() }
}
