package com.rupeeflow.mobile.finance

import android.content.Context
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.security.MessageDigest

/** Private durable inbox shared by the SMS receiver, notification listener, and React bridge. */
class FinanceStore private constructor(context: Context) : SQLiteOpenHelper(context, "finance-inbox.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT UNIQUE NOT NULL, source TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL)")
  }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { /* Add explicit migrations when schema changes. */ }

  fun record(source: String, sender: String, body: String, at: Long): Boolean {
    if (!financial(body)) return false
    val text = body.take(12000).replace(Regex("\\s+"), " ").trim()
    val identity = "$source|$sender|$at|$text"
    val hash = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray()).joinToString("") { "%02x".format(it) }
    val values = ContentValues().apply {
      put("event_id", hash); put("source", source); put("sender", sender); put("body", text); put("at", at)
    }
    return writableDatabase.insertWithOnConflict("events", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
  }
  companion object {
    @Volatile private var instance: FinanceStore? = null
    fun get(context: Context): FinanceStore = instance ?: synchronized(this) {
      instance ?: FinanceStore(context.applicationContext).also { instance = it }
    }
    fun preferences(context: Context) = context.getSharedPreferences("finance-consent", Context.MODE_PRIVATE)
    fun financial(text: String): Boolean {
      if (Regex("\\b(otp|one[ -]time password|verification code|upi pin)\\b", RegexOption.IGNORE_CASE).containsMatchIn(text)) return false
      return Regex("₹|\\bINR\\b|\\bRs[. ]", RegexOption.IGNORE_CASE).containsMatchIn(text) &&
        Regex("debit|credit|paid|sent|received|balance|\\bbal\\b|refund|withdraw|deposit", RegexOption.IGNORE_CASE).containsMatchIn(text)
    }
  }
}
