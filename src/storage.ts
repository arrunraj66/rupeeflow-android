// Atomic JSON snapshots in the private app sandbox. Never recover by silently erasing corrupt data.
import * as FS from 'expo-file-system/legacy';
import { emptyLedger, Ledger } from './model';
const directory = `${FS.documentDirectory}.rupeeflow/`;
const statePath = `${directory}ledger-v2.json`;
export async function load(): Promise<Ledger> {
  if (!(await FS.getInfoAsync(statePath)).exists) return emptyLedger();
  return validate(JSON.parse(await FS.readAsStringAsync(statePath)));
}
export function validate(value: unknown): Ledger {
  const s = value as Ledger;
  if (!s || s.schema !== 2 || !s.profile || typeof s.profile.email !== 'string' || typeof s.profile.name !== 'string' ||
      !Number.isFinite(s.profile.opacity) || !s.plan || !Number.isSafeInteger(s.plan.paise) || s.plan.paise < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.plan.start) || !/^\d{4}-\d{2}-\d{2}$/.test(s.plan.end) ||
      !Array.isArray(s.entries) || !Array.isArray(s.balances) || !Array.isArray(s.review) || !s.seen || typeof s.seen !== 'object' ||
      !Number.isSafeInteger(s.checkpoint) || s.entries.some(e => !e || typeof e.id !== 'string' || !Array.isArray(e.eventIds) ||
        !Number.isSafeInteger(e.paise) || e.paise <= 0 || !Number.isFinite(e.at) || !['credit', 'debit'].includes(e.kind) || typeof e.raw !== 'string' || typeof e.merchant !== 'string') ||
      s.balances.some(b => !b || typeof b.account !== 'string' || typeof b.bank !== 'string' || !Number.isSafeInteger(b.paise) || !Number.isFinite(b.at)) ||
      s.review.some(r => !r || typeof r.id !== 'string' || !r.message || typeof r.message.body !== 'string' || !Number.isFinite(r.message.at))) {
    throw new Error('This is not a valid RupeeFlow v2 backup. Existing data was not changed.');
  }
  return s;
}
export async function save(state: Ledger) {
  await FS.makeDirectoryAsync(directory, { intermediates: true });
  const staging = `${directory}ledger-next.json`;
  await FS.writeAsStringAsync(staging, JSON.stringify(state));
  await FS.moveAsync({ from: staging, to: statePath });
}
export async function backup(state: Ledger) {
  const target = `${directory}backups/`;
  await FS.makeDirectoryAsync(target, { intermediates: true });
  const uri = `${target}rupeeflow-${Date.now()}.json`;
  await FS.writeAsStringAsync(uri, JSON.stringify(state));
  return uri;
}
export async function exportBackup(state: Ledger) {
  const grant = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!grant.granted) return false;
  const uri = await FS.StorageAccessFramework.createFileAsync(grant.directoryUri, `rupeeflow-${Date.now()}.json`, 'application/json');
  await FS.writeAsStringAsync(uri, JSON.stringify(state));
  return true;
}
