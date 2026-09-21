# Pulse Player 1.6.1

The app shell and Sound studio respect Android system-bar safe areas, keeping bottom tabs above three-button navigation on phones such as the iQOO Neo 10. Rebuild the native APK after installing the safe-area dependency.

Music and Video have separate tabs, searchable folder filters, persistent favourites and most/least-played lists. The media index is saved on-device, so songs appear immediately after reopening while a throttled refresh runs in the background. Manual refresh and Android media-change events still trigger a full rescan. Audio and video permissions are requested independently.

Use the palette button to switch between Midnight, Aurora, Sunset, and Ocean backgrounds. In Music, select any folder and tap the hide-folder action to exclude it; hidden folders can be restored from Appearance & privacy. For a clean, fast source, place songs in `Internal storage/Music/Pulse Player` and open the dedicated-folder shortcut.

The redesigned Sound studio has dedicated Meter, EQ, Enhancer, and Mixer pages. It uses Android session effects for five-zone equalization, bass impact, clarity shaping, supported spatial widening, loudness lift, and gain protection. The VU screen reads the app playback waveform with Android's audio-sampling permission; it does not capture or store microphone audio. Settings and playback speed persist across restarts. This applies to music, not video. Forced software decoding, transcoding, and destructive noise filtering are not implemented.

The native extension is maintained in `scripts/patch-audio.cjs`, runs on postinstall, and is pinned to expo-audio 1.1.1. Expo autolinking builds that module from source to include the extension.

Pulse Player is an ad-free local and direct-online audio/video player for Android and iOS. It automatically scans media stored on the device, accepts authorized direct media URLs, continues audio in the background, exposes lock-screen controls, and supports Picture in Picture for video.

## Features

- Automatic local audio and video discovery with a searchable library
- Folder-based browsing using the device media albums
- Automatic hiding of WhatsApp audio, voice notes, and call recordings (files are not deleted)
- Audio queue with previous, next, random, shuffle, seek, buffering, and automatic advance
- Persistent continuous-random mode: one tap starts randomly and keeps selecting shuffled songs until turned off
- Automatic Melody and Fast Beats smart groups based on song/folder naming; unmatched files remain in Other
- Persistent play counts, fully-listened counts, frequently-finished, and least-listened collections
- Background audio plus Android notification and lock-screen controls
- Bluetooth-headset and smartwatch play/pause, next, previous, seek, and system media-volume controls
- Shared Android audio focus, allowing simultaneous playback with YouTube and per-app routing through supported iQOO Audio Redirect settings
- Direct HTTP/HTTPS audio and video playback
- Full-screen native video controls and Picture in Picture
- Automatic embedded-subtitle detection with a persistent captions on/off control and language label
- Live stereo VU and waveform meter, draggable controls, six presets, bass, clarity, spatial width, loudness, speed, and clipping protection
- No ad SDK, analytics SDK, account, or tracking

Pulse Player does not remove advertisements from third-party platforms or bypass DRM/access controls. Online playback expects a direct media URL that the user is authorized to access.

## Run locally

```bash
npm install
npm run typecheck
npm test
npm start
```

The local library may be limited in Expo Go on recent Android versions. For complete media permissions and background playback, create a development build:

```bash
npx expo prebuild --platform android
npm run android
```

To assemble an APK after prebuild:

```bash
npm run apk:debug
```

## Audio enhancement note

Android effects vary by phone, Bluetooth codec, and output device. Pulse reports when an effect cannot attach and keeps unsupported effects isolated so the rest of the DSP rack continues working. True broadband noise removal over decoded music requires a substantially heavier native processor and is not represented as active here.

## Key files

- `App.tsx` — app shell, players, local scan, queue, and all screens
- `app.json` — media permissions and background/Picture-in-Picture configuration
- `tests/app.test.mjs` — configuration and capability regression tests
