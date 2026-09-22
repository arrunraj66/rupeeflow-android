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

test('Android wake-up alarm native plugin is enabled', async () => {
  assert.equal(app.plugins.includes('./plugins/withWakeAlarm.cjs'), true);
  const plugin = await readFile(new URL('../plugins/withWakeAlarm.cjs', import.meta.url), 'utf8');
  for (const component of ['WakeAlarmActivity', 'WakeAlarmReceiver', 'WakeAlarmService', 'WakeAlarmPackage']) {
    assert.match(plugin, new RegExp(component));
  }
  for (const permission of ['USE_FULL_SCREEN_INTENT', 'WAKE_LOCK', 'USE_EXACT_ALARM']) assert.match(plugin, new RegExp(permission));
});

test('wake-up service loops alarm audio and offers Stop and Snooze', async () => {
  const service = await readFile(new URL('../native/alarm/WakeAlarmService.kt', import.meta.url), 'utf8');
  assert.match(service, /isLooping = true/);
  assert.match(service, /setFullScreenIntent\(full, true\)/);
  assert.match(service, /Snooze 5 min/);
  assert.match(service, /"Stop"/);
});

test('iOS background audio mode is enabled', () => {
  assert.deepEqual(app.ios.infoPlist.UIBackgroundModes, ['audio']);
});

test('all required native modules are declared', () => {
  for (const dependency of ['expo-notifications', 'expo-av', 'expo-document-picker', 'expo-file-system']) {
    assert.ok(pkg.dependencies[dependency], `missing ${dependency}`);
  }
});
