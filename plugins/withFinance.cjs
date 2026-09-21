// Reproducible native integration: prebuild regenerates receivers, bridge registration and vector icon.
const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const foreground = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#13243A" android:pathData="M22,24 L86,24 L86,84 L22,84 Z"/>
  <path android:strokeColor="#5DEBFF" android:strokeWidth="5" android:strokeLineCap="round" android:fillColor="@android:color/transparent" android:pathData="M36,74 L54,34 L72,74 M43,59 L65,59"/>
  <path android:fillColor="#9A7CFF" android:pathData="M76,24 L80,28 L76,32 L72,28 Z"/>
</vector>`;
module.exports = function withFinance(config) {
  config = withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];
    app.$['android:allowBackup'] = 'false'; // Avoid putting unencrypted financial messages into OS cloud backups.
    app.$['android:icon'] = '@drawable/rupeeflow_icon';
    app.$['android:roundIcon'] = '@drawable/rupeeflow_icon';
    app.receiver = (app.receiver || []).filter(x => x.$['android:name'] !== 'com.rupeeflow.mobile.finance.FinanceSmsReceiver');
    app.receiver.push({ $: { 'android:name': 'com.rupeeflow.mobile.finance.FinanceSmsReceiver', 'android:exported': 'true', 'android:permission': 'android.permission.BROADCAST_SMS' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }] }] });
    app.service = (app.service || []).filter(x => x.$['android:name'] !== 'com.rupeeflow.mobile.finance.FinanceNotificationListener');
    app.service.push({ $: { 'android:name': 'com.rupeeflow.mobile.finance.FinanceNotificationListener', 'android:label': 'Arun One payment alerts', 'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE', 'android:exported': 'true' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }] }] });
    manifest.queries ||= [{}];
    manifest.queries[0].package = ['com.google.android.apps.nbu.paisa.user', 'net.one97.paytm'].map(name => ({ $: { 'android:name': name } }));
    return config;
  });
  config = withMainApplication(config, config => {
    if (!config.modResults.contents.includes('add(com.rupeeflow.mobile.finance.FinancePackage())')) {
      const marker = 'PackageList(this).packages.apply {';
      if (!config.modResults.contents.includes(marker)) throw new Error('MainApplication template changed: FinancePackage must be registered.');
      config.modResults.contents = config.modResults.contents.replace(marker, marker + '\n              add(com.rupeeflow.mobile.finance.FinancePackage())');
    }
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const root = config.modRequest.projectRoot;
    const main = path.join(config.modRequest.platformProjectRoot, 'app/src/main');
    const java = path.join(main, 'java/com/rupeeflow/mobile/finance');
    fs.mkdirSync(java, { recursive: true });
    for (const file of fs.readdirSync(path.join(root, 'native'))) if (file.endsWith('.kt')) fs.copyFileSync(path.join(root, 'native', file), path.join(java, file));
    const drawable = path.join(main, 'res/drawable');
    const adaptive = path.join(main, 'res/drawable-v26');
    fs.mkdirSync(drawable, { recursive: true }); fs.mkdirSync(adaptive, { recursive: true });
    fs.writeFileSync(path.join(drawable, 'rupeeflow_foreground.xml'), foreground);
    // The themed mask must contain only the rupee mark, not the filled foreground square.
    fs.writeFileSync(path.join(drawable, 'rupeeflow_monochrome.xml'), foreground.replace(/<path android:fillColor="#13243A"[^>]*\/>/, ''));
    fs.writeFileSync(path.join(drawable, 'rupeeflow_icon.xml'), foreground.replace('<path android:fillColor="#13243A"', '<path android:fillColor="#081020" android:pathData="M0,0 L108,0 L108,108 L0,108 Z"/><path android:fillColor="#13243A"'));
    fs.writeFileSync(path.join(adaptive, 'rupeeflow_icon.xml'), '<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@android:color/black"/><foreground android:drawable="@drawable/rupeeflow_foreground"/><monochrome android:drawable="@drawable/rupeeflow_monochrome"/></adaptive-icon>');
    return config;
  }]);
};
