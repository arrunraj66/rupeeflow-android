import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('Android has the permissions required by alarms and background audio', () => {
  const permissions = new Set(app.android.permissions);
  for (const permission of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK']) {
    assert.equal(permissions.has(permission), true, `missing ${permission}`);
  }
});

test('iOS background audio mode is enabled', () => {
  assert.deepEqual(app.ios.infoPlist.UIBackgroundModes, ['audio']);
});

test('all required native modules are declared', () => {
  for (const dependency of ['expo-notifications', 'expo-av', 'expo-document-picker', 'expo-file-system']) {
    assert.ok(pkg.dependencies[dependency], `missing ${dependency}`);
  }
});
