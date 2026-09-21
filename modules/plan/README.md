# Dayflow

Dayflow is a private, on-device personal organizer for Android and iOS. It combines a daily dashboard, scheduled tasks, repeating alarms, a background audio player, and a small integration hub in one calm mobile experience.

## Included

- Today dashboard with progress, next task, and timeline
- Persistent tasks with priority, notes, time, completion, and sharing
- Local task reminders and one-time or repeating alarms
- Music import from the phone, a persistent private library, and background playback
- Quick links for Calendar, Todoist, Spotify, and Slack
- Google Calendar event handoff and the phone's universal share sheet
- Local-first storage; no account or server is required

## Run it

Requirements: Node.js 20+, Android Studio for Android builds, or Xcode for iOS builds.

```bash
npm install
npm start
```

The interface can be previewed with Expo Go. For exact-alarm permissions, notification channels, and reliable background audio, create a native development build:

```bash
npm run android
```

Connect an Android phone with USB debugging enabled, or start an emulator first. On Android 12+, allow **Alarms & reminders** for Dayflow if the phone asks. On heavily optimized Android devices, excluding Dayflow from battery optimization improves alarm reliability.

## Verification

```bash
npm run typecheck
npm test
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform android
```

## Integration model

Mobile operating systems do not allow one app unrestricted access to every installed app. Dayflow therefore uses safe, supported mechanisms: app deep links, Google Calendar URLs, Android/iOS share sheets, and a dedicated adapter file at `src/lib/integrations.ts`. Add an adapter when another service exposes an API or URL scheme; private APIs and accessibility-based automation are intentionally not used.

## Production notes

Before store release, replace the default Expo icon/splash assets, choose the final application identifiers in `app.json`, test alarm delivery on the target phone brands, and create signed release builds with EAS or the native Android/iOS toolchains.
