import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import { DeviceEventEmitter } from 'react-native';
import type { AppState, Alarm, Task } from '../modules/plan/src/types';
import { emptyState } from '../modules/plan/src/lib/storage';
import { makeId } from '../modules/plan/src/lib/date';
import { scheduleAlarm } from '../modules/plan/src/lib/notifications';
import type { BackupV2, FeatureKey, MediaTrack, MoneyInsight, OneSettings, OneSnapshot, SearchResult } from './types';
import type { Ledger } from '../modules/money/src/model';

export const SETTINGS_KEY = '@arun-one/settings/v2';
const PLAN_KEY = '@dayflow/state/v1';
const MEDIA_KEY = '@hush/library-index-v2';
const ledgerDirectory = `${FS.documentDirectory}.rupeeflow/`;
const ledgerPath = `${ledgerDirectory}ledger-v2.json`;
export const featureKeys: FeatureKey[] = ['dashboard','globalSearch','assistant','permissionCentre','automation','privacyLock','encryptedBackup','widgets','smartMoney','mediaPro','alarmPro','accessibility'];
export const featureLabels: Record<FeatureKey, string> = {
  dashboard:'Unified dashboard',globalSearch:'Global search',assistant:'Offline assistant',permissionCentre:'Permission centre',automation:'Automation routines',privacyLock:'Privacy lock',encryptedBackup:'Encrypted backup',widgets:'Home widgets',smartMoney:'Smart Money',mediaPro:'Media Pro',alarmPro:'Advanced alarms',accessibility:'Accessibility tools',
};
export const defaultSettings: OneSettings = {
  features: Object.fromEntries(featureKeys.map(key => [key, true])) as Record<FeatureKey, boolean>,
  lockEnabled: false, hideBalances: false, language: 'English', clock24: true,
  routines: { morningBrief: true, budgetWatch: true, bedtimeReview: false, billReminder: true },
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY); if (!raw) return defaultSettings;
    const saved = JSON.parse(raw) as Partial<OneSettings>;
    return { ...defaultSettings, ...saved, features: { ...defaultSettings.features, ...saved.features }, routines: { ...defaultSettings.routines, ...saved.routines } };
  } catch { return defaultSettings; }
}
export const saveSettings = (settings: OneSettings) => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

export async function loadSnapshot(): Promise<OneSnapshot> {
  const pairs = await AsyncStorage.multiGet([PLAN_KEY, MEDIA_KEY]);
  const planRaw = pairs[0]?.[1]; const mediaRaw = pairs[1]?.[1];
  let plan = emptyState; let tracks: MediaTrack[] = []; let ledger: Ledger | undefined;
  try { if (planRaw) plan = { ...emptyState, ...JSON.parse(planRaw) }; } catch {}
  try { if (mediaRaw) tracks = JSON.parse(mediaRaw).tracks || []; } catch {}
  try { if ((await FS.getInfoAsync(ledgerPath)).exists) ledger = JSON.parse(await FS.readAsStringAsync(ledgerPath)); } catch {}
  return { tasks: plan.tasks || [], alarms: plan.alarms || [], tracks, ledger };
}

export function searchSnapshot(snapshot: OneSnapshot, query: string): SearchResult[] {
  const q = query.trim().toLowerCase(); if (!q) return [];
  const has = (...parts: unknown[]) => parts.some(v => String(v ?? '').toLowerCase().includes(q));
  return [
    ...snapshot.tasks.filter(x => has(x.title,x.notes,x.priority)).map(x => ({ id:x.id,type:'Task' as const,title:x.title,detail:new Date(x.dueAt).toLocaleString(),space:'Plan' as const })),
    ...snapshot.alarms.filter(x => has(x.label,`${x.hour}:${x.minute}`)).map(x => ({ id:x.id,type:'Alarm' as const,title:x.label,detail:`${String(x.hour).padStart(2,'0')}:${String(x.minute).padStart(2,'0')}`,space:'Plan' as const })),
    ...snapshot.tracks.filter(x => has(x.title,x.artist,x.folder)).map(x => ({ id:x.id,type:x.kind==='video'?'Video' as const:'Song' as const,title:x.title,detail:x.artist || x.folder,space:'Media' as const })),
    ...(snapshot.ledger?.entries || []).filter(x => has(x.merchant,x.category,x.bank,x.reference)).map(x => ({ id:x.id,type:'Transaction' as const,title:x.merchant || x.category,detail:`${x.kind==='debit'?'−':'+'} ₹${(x.paise/100).toLocaleString('en-IN')}`,space:'Money' as const })),
  ].slice(0,80);
}

export function moneyInsights(snapshot: OneSnapshot): MoneyInsight {
  const entries = (snapshot.ledger?.entries || []).filter(e => !e.excluded);
  const now = new Date(); const month = entries.filter(e => { const d=new Date(e.at); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
  const groups = new Map<string,{count:number,total:number}>();
  for (const e of entries.filter(e=>e.kind==='debit')) { const key=e.merchant||e.category; const old=groups.get(key)||{count:0,total:0}; groups.set(key,{count:old.count+1,total:old.total+e.paise}); }
  const recurring=[...groups].filter(([,v])=>v.count>=2).map(([merchant,v])=>({merchant,count:v.count,averagePaise:Math.round(v.total/v.count)})).sort((a,b)=>b.count-a.count).slice(0,6);
  const day=Math.max(1,now.getDate()); const monthDebit=month.filter(e=>e.kind==='debit').reduce((n,e)=>n+e.paise,0);
  return { recurring, monthDebit, monthCredit:month.filter(e=>e.kind==='credit').reduce((n,e)=>n+e.paise,0), forecastDebit:Math.round(monthDebit/day*new Date(now.getFullYear(),now.getMonth()+1,0).getDate()), entries };
}

export async function createQuickTask(title: string) {
  const raw=await AsyncStorage.getItem(PLAN_KEY); const state:AppState=raw?{...emptyState,...JSON.parse(raw)}:emptyState;
  const due=new Date(Date.now()+60*60*1000);
  const task:Task={id:makeId(),title,notes:'Created by Arun Assistant',dueAt:due.toISOString(),priority:'Medium',completed:false};
  await AsyncStorage.setItem(PLAN_KEY,JSON.stringify({...state,tasks:[...state.tasks,task]})); DeviceEventEmitter.emit('one:data-changed'); return task;
}
export async function createQuickAlarm(label: string, hour: number, minute: number) {
  const raw=await AsyncStorage.getItem(PLAN_KEY); const state:AppState=raw?{...emptyState,...JSON.parse(raw)}:emptyState;
  const alarm:Alarm={id:makeId(),label,hour,minute,days:[],enabled:true,notificationIds:[]}; alarm.notificationIds=await scheduleAlarm(alarm);
  await AsyncStorage.setItem(PLAN_KEY,JSON.stringify({...state,alarms:[...state.alarms,alarm]})); DeviceEventEmitter.emit('one:data-changed'); return alarm;
}

export async function createBackup(): Promise<BackupV2> {
  const keys=(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith('@dayflow/')||k.startsWith('@hush/')||k.startsWith('@pulse/')||k.startsWith('@arun-one/'));
  const pairs=await AsyncStorage.multiGet(keys); const asyncStorage=Object.fromEntries(pairs.filter((x):x is [string,string]=>x[1]!==null));
  const snapshot=await loadSnapshot(); return {format:'arun-one-backup',version:2,createdAt:Date.now(),asyncStorage,ledger:snapshot.ledger};
}
export async function restoreBackup(value: BackupV2) {
  if (!value||value.format!=='arun-one-backup'||value.version!==2||!value.asyncStorage) throw new Error('This is not a valid Arun One 2.0 backup.');
  await AsyncStorage.multiSet(Object.entries(value.asyncStorage));
  if (value.ledger) { await FS.makeDirectoryAsync(ledgerDirectory,{intermediates:true}); await FS.writeAsStringAsync(ledgerPath,JSON.stringify(value.ledger)); }
  DeviceEventEmitter.emit('one:data-changed');
}
