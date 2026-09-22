const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withWakeAlarm(config) {
  config = withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];
    manifest['uses-permission'] ||= [];
    for (const name of ['android.permission.USE_FULL_SCREEN_INTENT','android.permission.WAKE_LOCK','android.permission.USE_EXACT_ALARM']) {
      if (!manifest['uses-permission'].some(p => p.$['android:name'] === name)) manifest['uses-permission'].push({ $: { 'android:name': name } });
    }
    app.activity ||= []; app.receiver ||= []; app.service ||= [];
    app.activity = app.activity.filter(x => x.$['android:name'] !== 'com.arun.one.alarm.WakeAlarmActivity');
    app.activity.push({ $: { 'android:name':'com.arun.one.alarm.WakeAlarmActivity','android:exported':'false','android:excludeFromRecents':'true','android:launchMode':'singleTask','android:showWhenLocked':'true','android:turnScreenOn':'true','android:theme':'@android:style/Theme.Material.NoActionBar' } });
    app.receiver = app.receiver.filter(x => x.$['android:name'] !== 'com.arun.one.alarm.WakeAlarmReceiver');
    app.receiver.push({ $: { 'android:name':'com.arun.one.alarm.WakeAlarmReceiver','android:exported':'true' }, 'intent-filter': [{ action: [
      { $: { 'android:name':'android.intent.action.BOOT_COMPLETED' } }, { $: { 'android:name':'android.intent.action.MY_PACKAGE_REPLACED' } }
    ] }] });
    app.service = app.service.filter(x => x.$['android:name'] !== 'com.arun.one.alarm.WakeAlarmService');
    app.service.push({ $: { 'android:name':'com.arun.one.alarm.WakeAlarmService','android:exported':'false','android:foregroundServiceType':'mediaPlayback' } });
    return config;
  });
  config = withMainApplication(config, config => {
    if (!config.modResults.contents.includes('add(com.arun.one.alarm.WakeAlarmPackage())')) {
      const marker='PackageList(this).packages.apply {';
      if (!config.modResults.contents.includes(marker)) throw new Error('MainApplication template changed: WakeAlarmPackage must be registered.');
      config.modResults.contents=config.modResults.contents.replace(marker, marker+'\n              add(com.arun.one.alarm.WakeAlarmPackage())');
    }
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const root=config.modRequest.projectRoot;
    const java=path.join(config.modRequest.platformProjectRoot,'app/src/main/java/com/arun/one/alarm');
    fs.mkdirSync(java,{recursive:true});
    for (const file of fs.readdirSync(path.join(root,'native/alarm'))) if (file.endsWith('.kt')) fs.copyFileSync(path.join(root,'native/alarm',file),path.join(java,file));
    return config;
  }]);
};
