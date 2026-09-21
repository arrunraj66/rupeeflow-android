// All amounts use integer paise. Balances retain a timestamped bank or user-verified baseline.
export type Source = 'sms' | 'notification' | 'manual';
export type Category = 'Food' | 'Fuel' | 'Shopping' | 'Bills' | 'Travel' | 'Health' | 'Income' | 'Transfer' | 'Other';
export const categories: Category[] = ['Food', 'Fuel', 'Shopping', 'Bills', 'Travel', 'Health', 'Income', 'Transfer', 'Other'];
export interface Message {
  id: string;
  seq?: number;
  source: Source;
  sender: string;
  body: string;
  at: number;
}
export interface Entry {
  id: string;
  eventIds: string[];
  kind: 'credit' | 'debit';
  paise: number;
  at: number;
  account?: string;
  bank?: string;
  app: string;
  reference?: string;
  merchant: string;
  category: Category;
  raw: string;
  source: Source;
  excluded?: boolean;
  possibleDuplicate?: boolean;
}
export interface Balance {
  id: string;
  account: string;
  bank: string;
  paise: number;
  at: number;
  source: Source;
  raw: string;
}
export interface Review { id: string; message: Message; reason: string; dismissed?: boolean }
export interface Plan { start: string; end: string; paise: number }
export interface Ledger {
  schema: 2;
  entries: Entry[];
  balances: Balance[];
  review: Review[];
  seen: Record<string, true>;
  checkpoint: number;
  profile: { name: string; email: string; opacity: number };
  plan: Plan;
  lastSync?: number;
}
export function localDay(at: number) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function emptyLedger(): Ledger {
  const now = new Date();
  return { schema: 2, entries: [], balances: [], review: [], seen: {}, checkpoint: 0,
    profile: { name: 'My money', email: '', opacity: 0.4 },
    plan: { start: localDay(new Date(now.getFullYear(), now.getMonth(), 1).getTime()), end: localDay(new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime()), paise: 0 } };
}
export function money(paise: number) { return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
