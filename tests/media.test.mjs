import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
const source = await readFile(new URL('../modules/media/App.tsx', import.meta.url), 'utf8');
const studio = await readFile(new URL('../modules/media/src/PlayerScreens.tsx', import.meta.url), 'utf8');
const audioPatch = await readFile(new URL('../scripts/patch-audio.cjs', import.meta.url), 'utf8');

test('app config enables media and background playback', () => {
  const permissions = new Set(app.android.permissions);
  for (const permission of ['INTERNET', 'READ_MEDIA_AUDIO', 'READ_MEDIA_VIDEO', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK']) {
    assert.equal(permissions.has(permission), true, `missing ${permission}`);
  }
  const plugins = new Map(app.plugins.map((plugin) => Array.isArray(plugin) ? [plugin[0], plugin[1]] : [plugin, {}]));
  assert.equal(plugins.get('expo-audio').enableBackgroundPlayback, true);
  assert.equal(plugins.get('expo-video').supportsPictureInPicture, true);
});

test('player includes local scan, direct URLs, and lock-screen controls', () => {
  for (const marker of ['getAssetsAsync', 'requestPermissionsAsync', 'setActiveForLockScreen', 'useVideoPlayer', 'https?:\\/\\/']) {
    assert.equal(source.includes(marker), true, `App.tsx missing ${marker}`);
  }
});

test('enhancement language does not misrepresent native DSP support', () => {
  assert.equal(source.includes('True real-time denoising still requires compatible native/device DSP'), true);
  assert.equal(source.includes('does not bypass ads, DRM, or access controls'), true);
});

test('library folders, privacy filters, shuffle, and listening stats are implemented', () => {
  for (const marker of ['page.hasNextPage', 'hiddenAudio', 'isHiddenAudio', 'getAlbumsAsync', 'AppState.addEventListener', 'Math.random()', 'Frequently finished', 'Least listened', 'AsyncStorage.setItem']) {
    assert.equal(source.includes(marker), true, `App.tsx missing ${marker}`);
  }
});

test('library is cached, scans are throttled, and smart music groups are available', () => {
  for (const marker of ['LIBRARY_KEY', 'SCAN_COOLDOWN_MS', 'first: 1000', 'Promise.all', 'smartCategory', "'Fast Beats'", "'Melody'"]) {
    assert.equal(source.includes(marker), true, `App.tsx missing ${marker}`);
  }
});

test('themes and user-hidden folders persist', () => {
  for (const marker of ['THEMES', 'THEME_KEY', 'HIDDEN_FOLDERS_KEY', 'ThemePanel', 'hideFolder', 'Pulse Player']) {
    assert.equal(source.includes(marker), true, `App.tsx missing ${marker}`);
  }
});

test('Bluetooth and smartwatch media-session queue controls are enabled', () => {
  for (const marker of ['hushSetQueue', 'hushSetShuffle', 'currentMediaItemIndex', 'showSeekBackward', 'updateLockScreenMetadata']) {
    assert.equal(source.includes(marker), true, `App.tsx missing ${marker}`);
  }
});

test('player mixes with other Android media apps', () => {
  assert.equal(source.includes("interruptionMode: 'mixWithOthers'"), true);
  assert.equal(source.includes("interruptionMode: 'doNotMix'"), false);
});

test('sound studio uses native DSP, saved controls, and real playback metering', () => {
  for (const marker of ['hushSoundStudio', 'BassBoost', 'LoudnessEnhancer', 'Virtualizer', 'safe gain']) {
    assert.equal(audioPatch.includes(marker), true, `native audio patch missing ${marker}`);
  }
  for (const marker of ['SOUND_SETTINGS_KEY', 'useAudioSampleListener', 'requestRecordingPermissionsAsync', 'playbackRate']) {
    assert.equal(source.includes(marker), true, `App.tsx missing ${marker}`);
  }
  for (const marker of ['LIVE OUTPUT', 'Real playback waveform', "'Meter'|'EQ'|'Enhancer'|'Mixer'", 'Clipping protection']) {
    assert.equal(studio.includes(marker), true, `Sound studio missing ${marker}`);
  }
});

test('video player detects embedded captions and provides a persistent subtitle toggle', () => {
  for (const marker of ['availableSubtitleTracksChange', 'subtitleTrack', 'SUBTITLES_KEY', 'Subtitles ${subtitlesOn', 'Live Caption']) {
    assert.equal(source.includes(marker), true, `subtitle player missing ${marker}`);
  }
});

test('random play enables a saved continuous shuffle mode', () => {
  for (const marker of ['SHUFFLE_KEY', 'setShuffleMode(true)', 'continuous random play']) {
    assert.equal(source.includes(marker), true, `continuous random mode missing ${marker}`);
  }
});
