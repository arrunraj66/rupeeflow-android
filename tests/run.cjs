// Compile only pure domain files to a disposable directory; no phone data is used in tests.
const { execFileSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = mkdtempSync(path.join(tmpdir(), 'rupeeflow-tests-'));
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--module', 'commonjs', '--target', 'ES2020', '--skipLibCheck', '--strict', '--outDir', out, 'src/model.ts', 'src/parser.ts', 'src/ledger.ts']);
const { parseMessage } = require(path.join(out, 'parser.js'));
const { currentBalance, ingest } = require(path.join(out, 'ledger.js'));
const { emptyLedger } = require(path.join(out, 'model.js'));
const msg = (body, id = 'sms1', at = 1700000000000, source = 'sms') => ({ body, id, at, source, sender: 'VM-HDFCBK' });
const debit = msg('Avl Bal: Rs.5,000.00. A/c XX1234 debited Rs.850.50 at Shell Petrol via UPI Ref 123456789012.');
assert.equal(parseMessage(debit).entry.paise, 85050);
assert.equal(parseMessage(debit).balance.paise, 500000);
assert.equal(parseMessage(debit).entry.category, 'Fuel');
assert.equal(parseMessage(msg('INR 500 credited to a/c XX1234 from Ravi.')).entry.kind, 'credit');
assert.equal(parseMessage(msg('A/c XX1234 Available balance: Rs.0.00')).balance.paise, 0);
for (const body of ['OTP 432123 to pay Rs.400', 'Rs.400 payment failed', 'Rs.400 will be debited tomorrow', 'Received a payment request for Rs.400', 'You paid Rs.400 and received Rs.200']) assert.equal(parseMessage(msg(body)).entry, undefined);
assert.equal(parseMessage(msg('Credit card available credit Rs.10,000')).balance, undefined);
assert.equal(parseMessage(msg('A/c XX1234 paid Rs.500; Avl bal Rs.1,000')).entry.paise, 50000);
let s = ingest(emptyLedger(), [debit, debit]);
assert.equal(s.entries.length, 1);
s = ingest(s, [msg('Paid Rs.850.50 to Shell via UPI Ref 123456789012', 'notif1', debit.at + 3000, 'notification')]);
assert.equal(s.entries.length, 1);
s = ingest(s, [msg('A/c XX1234 avl bal Rs.9,000', 'older', debit.at - 5000)]);
assert.equal(s.balances[0].paise, 500000);
s = ingest(s, [msg('A/c XX1234 avl bal Rs.4,000', 'newer', debit.at + 5000)]);
assert.equal(s.balances[0].paise, 400000);
s = ingest(s, [msg('Paid Rs.850.50 to Shell', 'uncertain', debit.at + 5000, 'notification')]);
assert.equal(s.entries.find(e => e.id === 'uncertain').possibleDuplicate, true);
assert.equal(s.entries.find(e => e.id === 'uncertain').excluded, true);
assert.equal(emptyLedger().entries.length, 0);
assert.equal(parseMessage(msg('Ravi sent you ₹100')).entry.kind, 'credit');
assert.equal(parseMessage(msg('A/c XX1234 transferred Rs.100 to a/c XX5678. Avl Bal Rs.4,000')).balance, undefined);
assert.equal(parseMessage({ ...msg('A/c XX1234 credited Rs.100 from HDFC; avl bal Rs.4,000'), sender: 'VM-SBIUPI' }).balance.bank, 'SBI');
const snapshot = { id: 'bal', account: '1234', bank: 'HDFC', paise: 500000, at: 1000, source: 'sms', raw: 'balance' };
const entry = (id, kind, paise, at, account = '1234', source = 'sms', excluded = false) => ({ id, eventIds: [id], kind, paise, at, account, bank: 'HDFC', app: 'Bank', merchant: id, category: kind === 'credit' ? 'Income' : 'Other', raw: id, source, excluded });
const live = currentBalance(snapshot, [
  entry('same-alert', 'debit', 10000, 1000),
  entry('later-debit', 'debit', 25000, 2000),
  entry('later-credit', 'credit', 10000, 3000),
  entry('other-account', 'debit', 99900, 4000, '5678'),
  entry('manual', 'credit', 99900, 5000, '1234', 'manual'),
  entry('held', 'debit', 99900, 6000, '1234', 'sms', true),
]);
assert.deepEqual(live, { paise: 485000, delta: -15000, transactions: 2, updatedAt: 3000 });
console.log('Passed: balance isolation and estimation, direction, OTP/failure filtering, zero balance, category, idempotency, cross-source references, out-of-order balances, duplicate review, no demo data.');
