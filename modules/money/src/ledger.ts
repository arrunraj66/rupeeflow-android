// Idempotent merging: references merge repeated delivery; uncertain matches are held for review.
import { Balance, Entry, Ledger, Message } from './model';
import { parseMessage } from './parser';

/**
 * Estimate the current balance from a trusted bank snapshot and later confirmed
 * entries for the same account. Transactions without an account suffix are not
 * guessed into an account, and the transaction accompanying the snapshot itself
 * is excluded because the reported balance normally already includes it.
 */
export function currentBalance(balance: Balance, entries: Entry[]) {
  const later = entries.filter(entry => !entry.excluded && entry.source !== 'manual' &&
    entry.at > balance.at && entry.account === balance.account &&
    (!entry.bank || entry.bank === balance.bank));
  const delta = later.reduce((total, entry) => total + (entry.kind === 'credit' ? entry.paise : -entry.paise), 0);
  return { paise: balance.paise + delta, delta, transactions: later.length,
    updatedAt: later.reduce((latest, entry) => Math.max(latest, entry.at), balance.at) };
}

function sameReference(a: Entry, b: Entry) {
  return Boolean(a.reference && a.reference === b.reference && a.kind === b.kind && a.paise === b.paise &&
    (!a.account || !b.account || a.account === b.account) && (!a.bank || !b.bank || a.bank === b.bank));
}
export function ingest(state: Ledger, messages: Message[]): Ledger {
  const next: Ledger = { ...state, entries: state.entries.map(e => ({ ...e, eventIds: [...e.eventIds] })),
    balances: [...state.balances], review: [...state.review], seen: { ...state.seen } };
  for (const message of messages) {
    if (message.seq) next.checkpoint = Math.max(next.checkpoint, message.seq);
    if (next.seen[message.id]) continue;
    next.seen[message.id] = true;
    const { entry, balance, reason } = parseMessage(message);
    if (balance) {
      const index = next.balances.findIndex(b => b.bank === balance.bank && b.account === balance.account);
      if (index < 0) next.balances.push(balance);
      else if (next.balances[index]!.at < balance.at) next.balances[index] = balance;
    }
    if (reason) next.review.push({ id: message.id, message, reason });
    if (!entry) continue;
    const existing = next.entries.find(e => sameReference(e, entry) ||
      (e.raw === entry.raw && e.source === entry.source && e.at === entry.at));
    if (existing) {
      existing.eventIds.push(message.id);
      existing.account ||= entry.account;
      existing.bank ||= entry.bank;
      if (existing.app === 'Bank' && entry.app !== 'Bank') existing.app = entry.app;
      // Prefer the account-bearing bank SMS for evidence, retaining the linked payment app.
      if (entry.source === 'sms' && entry.account) { existing.raw = entry.raw; existing.source = 'sms'; }
      continue;
    }
    const suspect = next.entries.find(e => !e.excluded && e.kind === entry.kind && e.paise === entry.paise &&
      Math.abs(e.at - entry.at) < 120000 && (!e.reference || !entry.reference) &&
      (!e.account || !entry.account || e.account === entry.account) && (!e.bank || !entry.bank || e.bank === entry.bank));
    // Don't silently discard repeated purchases or double-count a bank SMS plus app notification.
    if (suspect) { entry.possibleDuplicate = true; entry.excluded = true; }
    next.entries.push(entry);
  }
  next.entries.sort((a, b) => b.at - a.at);
  next.lastSync = Date.now();
  return next;
}
