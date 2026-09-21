# RupeeFlow 2.2 — separate Android project

This folder is independent of the HUSH Player project in its parent folder. Package name `com.rupeeflow.mobile` updates the earlier RupeeFlow installation, while HUSH uses a different package. All financial records start empty; the old demonstration dataset is not imported.

## Install and enable

Install `RupeeFlow-2.2.0.apk` from this folder, or connect a phone with USB debugging and run:

```bash
adb install -r /home/intern/mobile/rupeeflow/RupeeFlow-2.2.0.apk
```

In **Inbox**, select 30/90/365 days or All SMS, then tap **Allow SMS & import**. Android requires your approval for READ_SMS and RECEIVE_SMS. Tap **Enable notification access** and enable **RupeeFlow payment alerts** in Android's notification access settings. These are separate grants; installing the app does not grant them.

On iQOO, if background capture is restricted, allow RupeeFlow background activity/autostart in system app/battery settings. After force-stop, reopen the app. A later SMS scan can recover missed SMS. Notifications dismissed before access was enabled cannot be recovered. On some sideloaded Android installations, Android requires allowing restricted settings from the app's system details before notification access can be enabled.

## What is implemented

- Custom rupee adaptive/vector launcher icon, including a themed icon resource.
- Historical SMS scan plus an Android SMS receiver that records new financial SMS while JavaScript is not running.
- An Android notification listener for Google Pay, PhonePe, Paytm, BHIM, and the explicit bank-app allowlist in `native/FinanceNotificationListener.kt`.
- OTP/unrelated-message filtering before private storage; no screen scraping, accessibility service, or PIN collection.
- Durable native SQLite inbox; messages are parsed into the ledger when the app is open. Active screens refresh every four seconds and resume refresh recovers missed SMS.
- Separate transaction amount and available-balance extraction, amount storage in integer paise, known bank/suffix grouping, timestamped latest bank-reported balances, and out-of-order message handling.
- A dashboard estimate that starts from the latest bank-reported balance and applies later confirmed credits/debits for that exact account. It refreshes as captured alerts are imported.
- A user-verified starting balance for banks such as ICICI whose transaction alerts do not contain a balance. Check it in the bank/UPI app, enter the amount and account suffix once, and later matching alerts adjust the estimate.
- Reference-based deduplication across bank SMS/payment-app notifications. Uncertain equal-amount/time matches are **excluded and held for review**, not silently counted or deleted. A confirmed duplicate stays excluded; a confirmed separate purchase is included.
- Monthly calendar with separate green credit and red expense amounts, day details, category corrections, and analytics from included records.
- Date-range budget, manual entries, pasted-alert import, profile, background opacity, hidden private backup snapshots, and user-selected JSON export/restore.
- Real system-inset handling so the iQOO status/navigation bars do not cover the UI.

## What a balance means

**Estimated current balance is not a direct bank connection.** For banks such as Indian Bank it starts from the newest explicit balance in a recognized bank alert. For banks such as ICICI that omit it, use **Set verified balance** after checking the bank/UPI app. RupeeFlow then applies later confirmed transactions carrying the same account suffix. It never assumes a zero opening balance, never assigns account-less or manual transactions to an account, and may be stale when an alert is missing or delayed. The screen shows both the estimate and its underlying bank-reported or user-verified amount/timestamp.

Google Pay/Paytm buttons open the installed payment app so you can check your balance there. Their protected balance results are not returned to this application. Public Google Pay UPI integrations support merchant payments; Paytm's checkout balance endpoint requires a transaction token and does not grant arbitrary access to all linked bank balances.

- Google: https://developers.google.com/pay/india/api/android/overview
- Paytm: https://business.paytm.com/docs/api/fetch-balance-info-api/

The parser handles common English INR messages. Unsupported/ambiguous messages go to review; card limits and card statements are not bank balances. Categorization is heuristic and editable. Only alerts the phone actually receives can be imported; encrypted/hidden notification text may be unavailable. Historical transaction dates use the SMS provider timestamp. Android can delay/stop background delivery; this is not a guaranteed always-on bank feed.

## Build from source / Android Studio

Use Node 20+ and Android Studio with JDK 17 and Android SDK 36. Dependencies are pinned to Expo SDK 54, including `expo-font` and Babel, to avoid the earlier native startup mismatches.

```bash
cd /home/intern/mobile/rupeeflow
npm ci
npm run typecheck
npm test
npm run prebuild
```

Set `sdk.dir` in `android/local.properties` to your Android SDK location (Android Studio can do this), then:

```bash
npm run apk
```

The new APK is `android/app/build/outputs/apk/release/app-release.apk`. The top-level `RupeeFlow-2.2.0.apk` is a delivery copy; copy the newly built release there after future changes if needed. Open this project's `android` directory in Android Studio, select `app` and your phone, and Run. Debug builds need `npm start`; the release APK embeds its JS and works without Metro. Release builds here use the generated debug certificate for personal testing. Supply your own signing key for distribution.

The native sources and icon are preserved by `plugins/withFinance.cjs`; regenerate via `npm run prebuild` after changing `native/` or the plugin. Do not edit the generated copies inside `android/app/src/main/java` directly.

## File map

| File | Responsibility |
| --- | --- |
| `App.tsx` | Five-tab shell, safe-area insets, detail-modal selection |
| `src/screens.tsx` | Plan/balances, calendar, insights, imports/permissions, profile/backup |
| `src/ui.tsx` | Glass surfaces and shared visual styling |
| `src/model.ts` | Domain schema, integer paise, local calendar dates; no sample data |
| `src/parser.ts` | Financial message parsing and conservative balance extraction |
| `src/ledger.ts` | Idempotent import, duplicate holds, newest balance merge |
| `src/useLedger.ts` | Serialized writes, durable checkpoints, foreground refresh |
| `src/capture.ts` | Typed React Native bridge and Android permission requests |
| `src/storage.ts` | Atomic JSON state, private snapshots, export and restore validation |
| `native/FinanceStore.kt` | Private SQLite inbox and early message filtering |
| `native/FinanceSmsReceiver.kt` | Multipart SMS receiver with background persistence |
| `native/FinanceNotificationListener.kt` | Supported-app notification listener |
| `native/FinanceModule.kt` | Android bridge, historical SMS query, inbox paging, system/app links |
| `plugins/withFinance.cjs` | Repeatable manifest/bridge/icon generation |
| `tests/run.cjs` | Synthetic-message parser/merge regression checks |

## Data and access

The native SQLite file is private to the app. Parsed data is saved at `<documentDirectory>/.rupeeflow/ledger-v2.json`. Private snapshots are stored in `.rupeeflow/backups/`. Dot prefixes do not encrypt files: protection is the Android app sandbox and device storage security. Exported JSON contains raw financial messages, so select a trusted destination. Android automatic cloud backup is disabled. No financial messages are sent over the network by this version.

Email is a local profile label, **not Google authentication or cross-device synchronization**. Gmail OAuth and Drive merge/sync are not wired into v2. This does not claim that two phones using the same email share a live database. JSON export/restore is available for manual transfer. A Google project and a conflict-aware synchronization implementation are still needed for cloud sync.

To pause collection use Inbox's pause buttons or revoke access in Android settings. Existing records remain available. To erase all local ledger and captured messages, use Android's Clear storage (this also removes private snapshots). Export first if you need a copy.

## Verification

`npm test` uses synthetic messages only and checks transaction/balance separation, failed/OTP message rejection, zero balances, repeat imports, cross-source reference deduplication, uncertain duplicate holds, and older balance messages arriving late. `npm run typecheck` checks all screens and native bridge types. An APK build checks Kotlin/manifest/resources; actual permission and background behavior must additionally be checked on the target phone.

Phone check: open the fresh ledger, confirm icon and empty balances; grant SMS access and import history twice (totals must not double); enable notification access; make an ordinary transaction in your own payment app and check its matching alert; compare the bank-reported balance and timestamp to the original bank SMS; background/reopen; revoke access and verify manual features still work. RupeeFlow never initiates payments.
