# Arun One 1.1.0 validation

Built application source: commit `9941f79265351eda7189a15dc0c51c574bcca4ea` on `codex/arun-one`.
APK build: https://github.com/arrunraj66/rupeeflow-android/actions/runs/35689288991
Wake-up alarm emulator check: https://github.com/arrunraj66/rupeeflow-android/actions/runs/35690612332

Passed:
- Complete TypeScript check with installed dependencies.
- Finance parser/ledger regression suite and 16 capability/integration checks.
- Android native project generation and universal release APK compilation.
- APK signature verification and downloaded artifact SHA-256 verification.
- Android 15/API 35 emulator installation, startup, Plan → Media → Money → Inbox navigation and return to Plan. No AndroidRuntime/ReactNativeJS errors were logged in this check.
- Visual inspection of Plan, Media and Money emulator screenshots.
- Android 15 exact alarm scheduling, locked-screen wake, full-screen ringing activity, visible Stop/Snooze controls, Stop dismissal and crash-log check.

APK package: `com.arun.one`, version 1.1.0, version code 2, minimum Android API 24 (Android 7.0), target API 36.
The APK uses a personal-testing signing certificate. It is not a Play Store production release.
The package-lock.json is copied from the successful APK build to retain exact dependency resolution.

Version 1.1.0 adds an Android AlarmManager wake-up implementation with a foreground ringing service, looping alarm sound, vibration, screen wake, full-screen Stop/Snooze activity, boot rescheduling and an in-app five-second test.

Still requires real-phone verification: iQOO background/autostart behavior, overnight alarm timing with OEM power management, real SMS and payment notifications, Bluetooth/headset controls, DSP availability and video PiP. Emulator checks do not prove full feature parity on every device.

Private data does not transfer automatically between the old app IDs and this new app. RupeeFlow JSON backup restore is provided; the originals do not expose an equivalent export for Dayflow tasks or Pulse private preferences.
