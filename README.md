# Arun One

Combined Android project: Dayflow + Pulse Player 1.6.1 + RupeeFlow 2.2.0.
One app ID (`com.arun.one`), one window-inset owner and one navigation shell.
The signed personal-testing APK has passed an Android 15 emulator install/navigation check. See VALIDATION.md for test scope.

## Preserved features

| Space | Included implementations |
| --- | --- |
| Plan | Today/progress/timeline, priority tasks, notes, completion/deletion, task sharing/calendar handoff, scheduled reminders, one-time and weekday alarms, imported music and seeking, service links |
| Media | Local music/video scanning, search/folders, favourites, hidden folders, smart groups, play counts, cached library, continuous random/shuffle, queue, seek, background audio, lock-screen/headset controls, direct URLs, video/PiP, embedded captions, themes, five-zone native EQ, bass/clarity/spatial/loudness/speed controls and real playback metering |
| Money | Historical SMS import, background SMS/payment notification capture, native SQLite inbox, conservative parser, integer-paise amounts, duplicate review, bank and verified balances, calendar, budgets, manual entries, analytics, corrections, profile, background opacity, private snapshots and JSON export/restore |

Original module READMEs remain under `modules/` as provenance; their standalone build paths and application names describe the originals. Build this project from the root.

## Android build

Requires Node 22, JDK 17 and Android SDK 36. The lockfile is retained from the successful APK build. Use npm ci for the same dependency versions.

```bash
npm ci
npm run typecheck
npm test
npm run prebuild
npm run apk
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.
Open the generated `android` folder in Android Studio for GUI builds.
GitHub Actions performs these steps on the `codex/arun-one` branch and uploads the APK plus checksum and package details.

The Expo-generated personal-testing certificate signs the release build; the JS bundle is embedded and does not require a development server. Use an owned private signing key before production distribution. Keep a consistent certificate for later in-place updates.

Target: Android 7.0+ (React Native 0.81 / Expo 54), including iQOO Neo 10. Universal build requests ARM64, ARMv7, x86_64 and x86. Actual installation, background behavior and optional DSP capabilities must be checked on devices. APK files do not install on iOS.

## Installation and data transfer

1. Download the built APK, open it on Android, and permit your browser/file manager to install this package if asked.
2. Export a JSON backup from the old RupeeFlow Profile screen, then restore it in Money → Profile. Re-grant SMS and notification access in Money → Inbox. This is a separate installation and does not overwrite the old apps.
3. Re-enter existing Dayflow tasks/alarms. The original does not expose a task export. Media rescans shared phone files; private Pulse favourites, play counts and settings do not transfer automatically.
4. Allow notifications and Alarms & reminders. For iQOO, check background activity/autostart restrictions if reminders or capture stop.
5. Test a reminder, then lock/unlock the phone while playing music. Switch among Plan/Media/Money and confirm playback remains active. Starting a different internal music player pauses the previous player.

Native finance classes retain their Java package but manifest receivers/services use fully qualified names to work under the new application ID. Android automatic backup remains disabled for financial privacy. RECORD_AUDIO is requested by the existing playback meter; no microphone recording feature is added.

No features beyond the originals are implied: no bank login/live bank API, automatic cross-device sync, speech-to-subtitle transcription, DRM removal or guaranteed simultaneous routing to two outputs.

## Provenance

- Dayflow: supplied `scheduling-app.zip`.
- Pulse Player: supplied `84e73b3b-dc5d-4eb3-8835-18909d431ff9.zip`.
- RupeeFlow: `arrunraj66/rupeeflow-android`, commit `64b998b4c2b0e40cfe6f1ce9b67cf7e26cdaf0c4`.
- Supplied finance APK config reports RupeeFlow 2.2.0, package `com.rupeeflow.mobile`, version code 5, matching repository configuration.
