# Arun One 1.0.0 validation

Built application source: commit `31116d34589d2f09ba525e1adb6624134cede270` on `codex/arun-one`.
APK build: https://github.com/arrunraj66/rupeeflow-android/actions/runs/35598493739
Emulator check: https://github.com/arrunraj66/rupeeflow-android/actions/runs/35598928398

Passed:
- Complete TypeScript check with installed dependencies.
- Finance parser/ledger regression suite and 16 capability/integration checks.
- Android native project generation and universal release APK compilation.
- APK signature verification and downloaded artifact SHA-256 verification.
- Android 15/API 35 emulator installation, startup, Plan → Media → Money → Inbox navigation and return to Plan. No AndroidRuntime/ReactNativeJS errors were logged in this check.
- Visual inspection of Plan, Media and Money emulator screenshots.

APK package: `com.arun.one`, version 1.0.0, version code 1, minimum Android API 24 (Android 7.0), target API 36.
The APK uses a personal-testing signing certificate. It is not a Play Store production release.
The package-lock.json is copied from the successful APK build to retain exact dependency resolution.

Still requires real-phone verification: iQOO background/autostart behavior, alarm timing with OEM power management, real SMS and payment notifications, Bluetooth/headset controls, DSP availability and video PiP. Emulator startup checks do not prove full feature parity on every device.

Private data does not transfer automatically between the old app IDs and this new app. RupeeFlow JSON backup restore is provided; the originals do not expose an equivalent export for Dayflow tasks or Pulse private preferences.
