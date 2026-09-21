import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const require=createRequire(import.meta.url);

test('claiming playback pauses other registered players and unmount cleanup is isolated', async()=>{
 const out=mkdtempSync(path.join(tmpdir(),'arun-playback-'));
 try {
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--module','commonjs','--target','ES2020','--skipLibCheck','--outDir',out,'shared/playback.ts']);
  const {registerPlayback,claimPlayback}=require(path.join(out,'playback.js'));
  let plan=0,media=0;
  const removePlan=registerPlayback('plan',()=>{plan++;});
  const old=registerPlayback('media',()=>{throw Error('replaced callback');});
  registerPlayback('media',()=>{media++;}); old();
  claimPlayback('plan');assert.equal(media,1);assert.equal(plan,0);
  claimPlayback('media');assert.equal(plan,1);
  removePlan();claimPlayback('media');assert.equal(plan,1);
  registerPlayback('plan',()=>Promise.reject(Error('released player')));
  claimPlayback('media');await new Promise(resolve=>setImmediate(resolve));
 } finally {rmSync(out,{recursive:true,force:true});}
});

test('finance plugin emits resolvable native components under the new application ID',async()=>{
 const out=mkdtempSync(path.join(tmpdir(),'arun-native-'));
 try {
  const callbacks={};
  const pluginApi={withAndroidManifest:(c,f)=>{callbacks.manifest=f;return c;},withMainApplication:(c,f)=>{callbacks.application=f;return c;},withDangerousMod:(c,[,f])=>{callbacks.files=f;return c;}};
  const module={exports:{}};
  vm.runInNewContext(readFileSync('plugins/withFinance.cjs','utf8'),{module,require:(id)=>id==='@expo/config-plugins'?pluginApi:require(id)});
  module.exports({android:{package:'com.arun.one'}});
  const result=callbacks.manifest({modResults:{manifest:{application:[{$:{}}]}}});
  const app=result.modResults.manifest.application[0];
  assert.equal(app.receiver[0].$['android:name'],'com.rupeeflow.mobile.finance.FinanceSmsReceiver');
  assert.equal(app.service[0].$['android:name'],'com.rupeeflow.mobile.finance.FinanceNotificationListener');
  assert.equal(app.$['android:allowBackup'],'false');
  const generated=callbacks.application({modResults:{contents:'PackageList(this).packages.apply {'}});
  assert.ok(generated.modResults.contents.includes('add(com.rupeeflow.mobile.finance.FinancePackage())'));
  await callbacks.files({modRequest:{projectRoot:process.cwd(),platformProjectRoot:out}});
  const kotlin=readFileSync(path.join(out,'app/src/main/java/com/rupeeflow/mobile/finance/FinanceModule.kt'),'utf8');
  assert.ok(kotlin.includes('class FinancePackage'));
  const icon=readFileSync(path.join(out,'app/src/main/res/drawable/rupeeflow_icon.xml'),'utf8');
  assert.ok(icon.includes('M36,74 L54,34 L72,74'));
 }finally{rmSync(out,{recursive:true,force:true});}
});
