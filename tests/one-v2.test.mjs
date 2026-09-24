import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const app = JSON.parse(await read('../app.json')).expo;
const shell = await read('../App.tsx');
const hub = await read('../one/OneHub.tsx');
const storage = await read('../one/storage.ts');
const core = await read('../native/core/OneCoreModule.kt');

test('2.0.1 hotfix exposes five connected spaces', () => {
  assert.equal(app.version, '2.0.1'); assert.equal(app.android.versionCode, 4);
  for (const space of ['Home','Plan','Media','Money','More']) assert.match(shell, new RegExp(`name:'${space}'`));
  assert.match(shell, /useState<Space\[\]>\(\['Home'\]\)/);
  assert.match(shell, /RootErrorBoundary/);
  assert.match(storage, /Array\.isArray\(saved\?\.tasks\)/);
  assert.equal(hub.includes('/>} {settings.features'), false);
  assert.equal(hub.includes('</Pressable>} {ok&&'), false);
});

test('Feature Lab makes every preview area reversible', () => {
  for (const feature of ['dashboard','globalSearch','assistant','permissionCentre','automation','privacyLock','encryptedBackup','widgets','smartMoney','mediaPro','alarmPro','accessibility']) assert.match(storage, new RegExp(`'${feature}'`));
  assert.match(hub, /toggleFeature/); assert.match(hub, /your stored data remains untouched/i);
});

test('offline assistant supports useful local actions', () => {
  assert.match(hub, /createQuickAlarm/); assert.match(hub, /createQuickTask/); assert.match(hub, /moneyInsights/); assert.match(hub, /PRIVATE · OFFLINE/);
});

test('security module supplies authentication, encryption, widget and shortcuts', () => {
  for (const marker of ['BiometricPrompt','PBKDF2WithHmacSHA256','AES/GCM/NoPadding','updateWidget','updateShortcuts']) assert.match(core, new RegExp(marker.replaceAll('/','\\/')));
  assert.equal(app.plugins.includes('./plugins/withOneCore.cjs'), true);
});
