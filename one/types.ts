import type { Alarm, Task } from '../modules/plan/src/types';
import type { Entry, Ledger } from '../modules/money/src/model';

export type FeatureKey =
  | 'dashboard' | 'globalSearch' | 'assistant' | 'permissionCentre'
  | 'automation' | 'privacyLock' | 'encryptedBackup' | 'widgets'
  | 'smartMoney' | 'mediaPro' | 'alarmPro' | 'accessibility';

export type OneSettings = {
  features: Record<FeatureKey, boolean>;
  lockEnabled: boolean;
  hideBalances: boolean;
  language: 'English' | 'Tamil' | 'Hindi';
  clock24: boolean;
  routines: Record<'morningBrief' | 'budgetWatch' | 'bedtimeReview' | 'billReminder', boolean>;
};

export type MediaTrack = { id: string; title: string; artist: string; uri: string; kind: 'audio' | 'video'; folder: string };
export type OneSnapshot = { tasks: Task[]; alarms: Alarm[]; tracks: MediaTrack[]; ledger?: Ledger };
export type SearchResult = { id: string; type: 'Task' | 'Alarm' | 'Song' | 'Video' | 'Transaction'; title: string; detail: string; space: 'Plan' | 'Media' | 'Money' };

export type BackupV2 = {
  format: 'arun-one-backup'; version: 2; createdAt: number;
  asyncStorage: Record<string, string>; ledger?: Ledger;
};

export type MoneyInsight = { recurring: { merchant: string; count: number; averagePaise: number }[]; monthDebit: number; monthCredit: number; forecastDebit: number; entries: Entry[] };
