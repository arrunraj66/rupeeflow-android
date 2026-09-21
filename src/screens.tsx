// Product screens use the same ledger. No page fabricates an opening bank balance.
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { allowSms, native } from './capture';
import { backup, exportBackup, validate } from './storage';
import { categories, Category, Entry, localDay, money } from './model';
import { currentBalance, ingest } from './ledger';
import { useLedger } from './useLedger';
import { Button, Card, C, Field, Heading, Page, S } from './ui';
export type Controller = ReturnType<typeof useLedger>;
export function run(action: () => Promise<unknown>) { void action().catch(e => Alert.alert('Could not complete', e instanceof Error ? e.message : String(e))); }
const pretty = (at: number) => new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const sign = (e: Entry) => `${e.kind === 'credit' ? '+' : '−'}${money(e.paise)}`;

export function PlanScreen({ controller: c }: { controller: Controller }) {
  const [editing, setEditing] = useState(false);
  const [settingBalance, setSettingBalance] = useState(false);
  const { plan, balances, entries } = c.state;
  const spent = entries.filter(e => !e.excluded && e.kind === 'debit' && localDay(e.at) >= plan.start && localDay(e.at) <= plan.end).reduce((v, e) => v + e.paise, 0);
  return <Page><Heading title="Your money" sub="RupeeFlow · personal ledger" />
    <Card><Text style={S.h}>Current balance</Text><Text style={S.muted}>Indian Bank and other alerts that contain a balance update automatically. For ICICI alerts without a balance, set one verified starting amount and later transactions will adjust it.</Text><Button disabled={c.busy} label={c.busy ? 'Updating…' : 'Update now'} onPress={() => run(() => c.sync())} /><Button label="Set verified balance" onPress={() => setSettingBalance(true)} /></Card>
    {balances.length === 0 && <Card><Text style={S.money}>Not known yet</Text><Text style={S.muted}>Open Inbox and allow SMS import. If your bank never includes its balance in a message, check it inside your bank or payment app.</Text></Card>}
    {balances.map(b => { const live = currentBalance(b, entries); return <Card key={`${b.bank}:${b.account}`}><Text style={S.h}>{b.bank} · ••{b.account}</Text><Text style={S.money}>{money(live.paise)}</Text><Text style={[S.muted, { color: C.cyan }]}>Estimated current · updated {pretty(live.updatedAt)}</Text><Text style={S.muted}>{b.source === 'manual' ? 'You verified' : 'Bank reported'} {money(b.paise)} at {pretty(b.at)}</Text>{live.transactions > 0 && <Text style={[S.muted, { color: live.delta >= 0 ? C.green : C.red }]}>{live.transactions} later confirmed alert{live.transactions === 1 ? '' : 's'} · {live.delta >= 0 ? '+' : '−'}{money(Math.abs(live.delta))}</Text>}<Text style={[S.muted, { color: C.violet }]}>An estimate from received alerts—not a direct bank connection.</Text></Card>; })}
    <View style={S.row}><View style={{ flex: 1 }}><Button label="Open Google Pay" onPress={() => run(async () => { if (!native) throw new Error('Use the Android APK'); await native.openPaymentApp('Google Pay'); })} /></View><View style={{ flex: 1 }}><Button label="Open Paytm" onPress={() => run(async () => { if (!native) throw new Error('Use the Android APK'); await native.openPaymentApp('Paytm'); })} /></View></View>
    <Text style={[S.muted, { marginTop: 10 }]}>Use Check balance inside the payment app. RupeeFlow cannot retrieve that protected screen or your UPI PIN.</Text>
    <Text style={S.section}>Expense plan</Text><Card><Text style={S.muted}>{plan.start} → {plan.end}</Text><Text style={S.money}>{plan.paise ? money(plan.paise - spent) : 'Set your budget'}</Text><Text style={S.muted}>{plan.paise ? 'Budget remaining · not bank balance' : 'Choose your dates and limit below'}</Text><Text style={[S.text, { marginTop: 12 }]}>Expenses in period: {money(spent)}</Text><Button label="Edit plan" onPress={() => setEditing(true)} /></Card>
    <Text style={S.muted}>Included totals exclude held duplicates. Review them in Inbox.</Text>
    <PlanEditor visible={editing} close={() => setEditing(false)} c={c} />
    <BalanceEditor visible={settingBalance} close={() => setSettingBalance(false)} c={c} />
  </Page>;
}
function validDay(s: string) { const d = new Date(`${s}T12:00:00`); return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(+d) && localDay(+d) === s; }
function PlanEditor({ visible, close, c }: { visible: boolean; close: () => void; c: Controller }) {
  const [start, setStart] = useState(c.state.plan.start), [end, setEnd] = useState(c.state.plan.end), [amount, setAmount] = useState(String(c.state.plan.paise / 100 || ''));
  return <Modal visible={visible} transparent onRequestClose={close}><View style={S.shade}><ScrollView style={S.sheet} keyboardShouldPersistTaps="handled"><Text style={S.h}>Plan this period</Text><Field label="Start · YYYY-MM-DD" value={start} onChangeText={setStart} /><Field label="End · YYYY-MM-DD" value={end} onChangeText={setEnd} /><Field label="Budget · ₹" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} /><Button label="Save plan" onPress={() => run(async () => {
    const paise = Math.round(Number(amount) * 100);
    if (!validDay(start) || !validDay(end) || start > end || !Number.isSafeInteger(paise) || paise <= 0) throw new Error('Enter valid dates and a positive budget.');
    await c.mutate(s => ({ ...s, plan: { start, end, paise } })); close();
  })} /><Button label="Cancel" onPress={close} /></ScrollView></View></Modal>;
}

const supportedBalanceBanks = ['ICICI', 'Indian Bank', 'HDFC', 'SBI', 'Axis', 'Kotak', 'Canara', 'Union Bank', 'Bank of Baroda', 'PNB', 'IDFC FIRST', 'Federal'];
function BalanceEditor({ visible, close, c }: { visible: boolean; close: () => void; c: Controller }) {
  const [bank, setBank] = useState('ICICI'), [account, setAccount] = useState(''), [amount, setAmount] = useState('');
  return <Modal visible={visible} transparent onRequestClose={close}><View style={S.shade}><ScrollView style={S.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}><Text style={S.h}>Set verified balance</Text><Text style={S.muted}>First check the amount in your bank, GPay, or Paytm. Enter only the final balance—never enter a PIN. RupeeFlow will apply matching account transactions received after this moment.</Text>
    <Text style={S.section}>Bank</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{supportedBalanceBanks.map(name => <Pressable key={name} onPress={() => setBank(name)} style={[S.pill, bank === name && { borderColor: C.cyan }]}><Text style={S.text}>{name}</Text></Pressable>)}</View>
    <Field label="Last 3 or 4 account digits" keyboardType="number-pad" value={account} onChangeText={setAccount} /><Field label="Verified balance · ₹" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
    <Button label="Use as starting balance" onPress={() => run(async () => {
      const suffix = account.replace(/\D/g, '').slice(-4), paise = Math.round(Number(amount.replace(/,/g, '')) * 100), at = Date.now();
      if (!/^\d{3,4}$/.test(suffix) || !Number.isSafeInteger(paise) || paise < 0) throw new Error('Enter the last 3 or 4 account digits and a valid balance.');
      await c.mutate(s => ({ ...s, balances: [...s.balances.filter(b => !(b.bank === bank && b.account === suffix)), { id: `verified-${at}`, bank, account: suffix, paise, at, source: 'manual' as const, raw: 'Balance verified by the user.' }] }));
      setAmount(''); close(); Alert.alert('Starting balance saved', 'New matching bank alerts will now adjust this estimate.');
    })} /><Button label="Cancel" onPress={close} /></ScrollView></View></Modal>;
}

export function CalendarScreen({ controller: c, onEntry }: { controller: Controller; onEntry: (e: Entry) => void }) {
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState(localDay(Date.now()));
  const year = month.getFullYear(), m = month.getMonth();
  const key = localDay(+month).slice(0, 7);
  const items = c.state.entries.filter(e => !e.excluded && localDay(e.at).startsWith(key));
  const total = (kind: string) => items.filter(e => e.kind === kind).reduce((v, e) => v + e.paise, 0);
  const cells = [...Array(month.getDay()).fill(0), ...Array.from({ length: new Date(year, m + 1, 0).getDate() }, (_, i) => i + 1)];
  const go = (n: number) => { const next = new Date(year, m + n, 1); setMonth(next); setDay(localDay(+next)); };
  const selected = items.filter(e => localDay(e.at) === day);
  return <Page><Heading title="Cash calendar" sub="Your imported and confirmed transactions" /><Card><View style={S.row}><Button label="‹" onPress={() => go(-1)} /><Text style={S.h}>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text><Button label="›" onPress={() => go(1)} /></View>
    <View style={{ flexDirection: 'row', marginTop: 16 }}>{['S','M','T','W','T','F','S'].map((v, i) => <Text key={i} style={[S.muted, { width: '14.285%', textAlign: 'center' }]}>{v}</Text>)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{cells.map((d, i) => { const date = localDay(+new Date(year, m, d || 1)); const rows = d ? items.filter(e => localDay(e.at) === date) : [];
      const inc = rows.filter(e => e.kind === 'credit').reduce((v, e) => v + e.paise, 0), out = rows.filter(e => e.kind === 'debit').reduce((v, e) => v + e.paise, 0);
      return <Pressable key={i} disabled={!d} onPress={() => setDay(date)} accessibilityLabel={d ? `${date}, credit ${money(inc)}, expense ${money(out)}` : ''} style={{ width: '14.285%', minHeight: 73, alignItems: 'center', paddingVertical: 7, borderRadius: 12, backgroundColor: d && day === date ? '#23445C' : 'transparent' }}>{!!d && <><Text style={S.text}>{d}</Text>{inc > 0 && <Text numberOfLines={1} style={{ fontSize: 9, color: C.green }}>+{compact(inc)}</Text>}{out > 0 && <Text numberOfLines={1} style={{ fontSize: 9, color: C.red }}>−{compact(out)}</Text>}</>}</Pressable>;
    })}</View></Card>
    <Card><View style={S.row}><View><Text style={S.muted}>Month credit</Text><Text style={[S.h, { color: C.green }]}>{money(total('credit'))}</Text></View><View><Text style={S.muted}>Month expense</Text><Text style={[S.h, { color: C.red }]}>{money(total('debit'))}</Text></View></View></Card>
    <Text style={S.section}>{day}</Text>{selected.map(e => <TransactionRow key={e.id} entry={e} onPress={() => onEntry(e)} />)}{!selected.length && <Card><Text style={S.muted}>No transactions recorded for this day.</Text></Card>}
  </Page>;
}
function compact(paise: number) { return paise >= 100000 ? `₹${(paise / 100000).toFixed(1)}k` : money(paise); }
export function TransactionRow({ entry: e, onPress }: { entry: Entry; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button"><Card><View style={S.row}><View style={{ flex: 1 }}><Text style={S.h}>{e.merchant}</Text><Text style={S.muted}>{e.category} · {e.app}{e.account ? ` · ••${e.account}` : ''}</Text><Text style={S.muted}>{pretty(e.at)}{e.excluded ? ' · Excluded' : ''}</Text></View><Text style={[S.text, { color: e.kind === 'credit' ? C.green : C.red, fontWeight: '700' }]}>{sign(e)}</Text></View></Card></Pressable>;
}
export function InsightsScreen({ controller: c }: { controller: Controller }) {
  const month = localDay(Date.now()).slice(0, 7);
  const entries = c.state.entries.filter(e => !e.excluded && e.kind === 'debit' && localDay(e.at).startsWith(month));
  const total = entries.reduce((v, e) => v + e.paise, 0);
  const groups = categories.map(name => ({ name, total: entries.filter(e => e.category === name).reduce((v, e) => v + e.paise, 0) })).filter(g => g.total).sort((a,b) => b.total - a.total);
  return <Page><Heading title="Spending insights" sub={`${month} · confirmed expenses`} /><Card><Text style={S.muted}>Recorded expenses this month</Text><Text style={S.money}>{money(total)}</Text><Text style={S.muted}>{entries.length} transactions · categories can be corrected by tapping a transaction.</Text></Card>
    {groups.map(g => <Card key={g.name}><View style={S.row}><Text style={S.h}>{g.name}</Text><Text style={S.text}>{money(g.total)}</Text></View><View style={{ backgroundColor: '#28344F', height: 8, borderRadius: 8, marginTop: 7 }}><View style={{ width: `${g.total / total * 100}%`, height: 8, backgroundColor: C.cyan, borderRadius: 8 }} /></View></Card>)}
    {!groups.length && <Text style={S.muted}>Import your financial messages in Inbox to see a breakdown.</Text>}
    <Text style={S.section}>Payment sources</Text>{['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Bank', 'Manual'].map(app => { const group = entries.filter(e => e.app === app); return group.length ? <Card key={app}><View style={S.row}><Text style={S.h}>{app}</Text><Text style={S.text}>{money(group.reduce((v,e) => v + e.paise, 0))}</Text></View></Card> : null; })}
  </Page>;
}

export function InboxScreen({ controller: c, onEntry }: { controller: Controller; onEntry: (e: Entry) => void }) {
  const [body, setBody] = useState(''), [sender, setSender] = useState(''), [date, setDate] = useState(localDay(Date.now()));
  const [days, setDays] = useState(90);
  const [manualAmount, setManualAmount] = useState(''), [manualName, setManualName] = useState('');
  const [manualKind, setManualKind] = useState<'credit' | 'debit'>('debit');
  const status = c.status;
  const held = c.state.entries.filter(e => e.possibleDuplicate);
  const reviews = c.state.review.filter(r => !r.dismissed);
  const enable = () => Alert.alert('Read financial SMS?', 'RupeeFlow will scan your chosen history and capture new SMS financial alerts in private device storage. OTPs and unrelated messages are discarded. You can turn capture off here.', [ { text: 'Cancel', style: 'cancel' }, { text: 'Allow SMS', onPress: () => run(async () => { await allowSms(); await c.sync(days === 0 ? 0 : Date.now() - days * 86400000); }) } ]);
  const notifications = () => Alert.alert('Read payment notifications?', 'Android grants broad notification access. RupeeFlow retains only financial alerts from supported payment and bank apps, excluding OTPs. It cannot read dismissed historical notifications or protected balance screens.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open settings', onPress: () => run(async () => { if (!native) throw new Error('Install the Android APK'); await native.setEnabled('notifications', true); await native.openNotificationSettings(); }) }]);
  return <Page><Heading title="Message inbox" sub="Automatic capture · local processing" /><Card><Text style={S.h}>SMS history & new messages</Text><Text style={S.muted}>{status?.smsEnabled && status.smsPermission ? `Capture enabled${status.receivePermission ? '' : ' · new-SMS permission missing'}` : 'SMS capture is off'}</Text><View style={[S.row, { marginTop: 10 }]}>{[30,90,365,0].map(n => <Pressable key={n} onPress={() => setDays(n)} style={[S.pill, days === n && { borderColor: C.cyan }]}><Text style={S.muted}>{n ? `${n} days` : 'All SMS'}</Text></Pressable>)}</View>
    <Button disabled={c.busy} label={c.busy ? 'Importing…' : status?.smsEnabled && status.smsPermission ? 'Import selected history' : 'Allow SMS & import'} onPress={() => status?.smsEnabled && status.smsPermission ? run(() => c.sync(days ? Date.now() - days * 86400000 : 0)) : enable()} />
    {status?.smsEnabled && <Button label="Pause SMS capture" onPress={() => run(async () => { await native?.setEnabled('sms', false); await c.sync(); })} />}</Card>
    <Card><Text style={S.h}>Payment notifications</Text><Text style={S.muted}>{status?.notificationAccess && status.notificationsEnabled ? 'Listening for supported payment alerts' : 'Notification access is off'}</Text><Text style={S.muted}>Google Pay, PhonePe, Paytm, BHIM and supported bank apps. Updates appear within a few seconds while open; captured alerts are processed when you return.</Text>
      <Button label="Enable notification access" onPress={notifications} />{status?.notificationsEnabled && <Button label="Pause notification capture" onPress={() => run(async () => { await native?.setEnabled('notifications', false); await c.sync(); })} />}
    </Card>
    <Button disabled={c.busy} label="Refresh captured alerts" onPress={() => run(() => c.sync())} />
    <Text style={[S.muted, { marginVertical: 12 }]}>{c.state.lastSync ? `Last imported ${pretty(c.state.lastSync)}` : 'No financial alerts imported yet.'}</Text>
    <Text style={S.section}>Needs your review · {held.length + reviews.length}</Text>
    {held.map(e => <View key={e.id}><Text style={[S.muted, { color: C.violet, marginBottom: 6 }]}>Possible duplicate · excluded from totals until confirmed</Text><TransactionRow entry={e} onPress={() => onEntry(e)} /></View>)}
    {reviews.slice(0, 30).map(r => <Card key={r.id}><Text style={S.h}>{r.reason}</Text><Text selectable style={S.muted}>{r.message.sender} · {pretty(r.message.at)}{'\n'}{r.message.body}</Text><Button label="Dismiss" onPress={() => run(() => c.mutate(s => ({ ...s, review: s.review.map(v => v.id === r.id ? { ...v, dismissed: true } : v) })))} /></Card>)}
    {reviews.length > 30 && <Text style={S.muted}>Showing 30 of {reviews.length} messages. Dismiss reviewed items to see more.</Text>}
    <Card><Text style={S.h}>Paste a transaction alert</Text><Text style={S.muted}>Useful for an alert that wasn't captured. The amount will be parsed; manually pasted text does not establish a bank balance.</Text><Field label="Sender / payment app" value={sender} onChangeText={setSender} /><Field label="Message date · YYYY-MM-DD" value={date} onChangeText={setDate} /><Field label="Message" multiline value={body} onChangeText={setBody} /><Button label="Parse and review" onPress={() => run(async () => {
      if (!body.trim() || !validDay(date)) throw new Error('Enter a message and valid date.');
      const message = { id: `paste-${Date.now()}`, body, sender, at: +new Date(`${date}T12:00:00`), source: 'manual' as const };
      await c.mutate(s => ingest(s, [message])); setBody(''); Alert.alert('Processed', 'Check transactions or the review list. Unrecognized and incomplete messages do not change totals.');
    })} /></Card>
    <Card><Text style={S.h}>Manual entry</Text><Text style={S.muted}>For cash, receipts, or an alert the parser cannot understand. Uses the message date entered above. Tap the saved transaction to choose a category.</Text><Field label="Merchant / description" value={manualName} onChangeText={setManualName} /><Field label="Amount · ₹" keyboardType="decimal-pad" value={manualAmount} onChangeText={setManualAmount} /><View style={S.row}>{(['debit','credit'] as const).map(kind => <Pressable key={kind} style={[S.pill, kind === manualKind && { borderColor: C.cyan }]} onPress={() => setManualKind(kind)}><Text style={S.text}>{kind === 'debit' ? 'Expense' : 'Credit'}</Text></Pressable>)}</View><Button label="Save manual entry" onPress={() => run(async () => {
      const paise = Math.round(Number(manualAmount) * 100);
      if (!manualName.trim() || !validDay(date) || !Number.isSafeInteger(paise) || paise <= 0) throw new Error('Enter a description, valid date, and positive amount.');
      const id = `manual-${Date.now()}`;
      const entry: Entry = { id, eventIds: [id], kind: manualKind, paise, at: date === localDay(Date.now()) ? Date.now() : +new Date(`${date}T12:00:00`), app: 'Manual', merchant: manualName.trim(), category: manualKind === 'credit' ? 'Income' : 'Other', source: 'manual', raw: 'Manually entered by you.' };
      await c.mutate(s => ({ ...s, entries: [entry, ...s.entries] })); setManualAmount(''); setManualName(''); Alert.alert('Saved');
    })} /></Card>
    <Text style={S.section}>Recent transactions</Text>{c.state.entries.slice(0, 30).map(e => <TransactionRow key={e.id} entry={e} onPress={() => onEntry(e)} />)}
  </Page>;
}

export function ProfileScreen({ controller: c }: { controller: Controller }) {
  const [name, setName] = useState(c.state.profile.name), [email, setEmail] = useState(c.state.profile.email);
  return <Page><Heading title="Profile & settings" sub="RupeeFlow 2.2.0" /><Card><Field label="Name" value={name} onChangeText={setName} /><Field label="Email label" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /><Button label="Save profile" onPress={() => run(async () => {
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
    await c.mutate(s => ({ ...s, profile: { ...s.profile, name: name.trim() || 'My money', email: email.trim().toLowerCase() } })); Alert.alert('Saved');
  })} /><Text style={[S.muted, { marginTop: 12 }]}>Email is a local label. This version does not authenticate Google accounts or synchronize two phones. Your data stays on this device unless you export it.</Text></Card>
    <Card><Text style={S.h}>Background visibility</Text><View style={S.row}>{[0,.2,.4,.7].map(value => <Pressable key={value} onPress={() => run(() => c.mutate(s => ({ ...s, profile: { ...s.profile, opacity: value } })))} style={[S.pill, c.state.profile.opacity === value && { borderColor: C.cyan }]}><Text style={S.text}>{Math.round(value * 100)}%</Text></Pressable>)}</View></Card>
    <Card><Text style={S.h}>Backups</Text><Text style={S.muted}>Private snapshots stay in the app's hidden directory. Export a JSON copy to transfer data; exported copies contain financial messages.</Text><Button label="Create private backup" onPress={() => run(async () => { await backup(c.state); Alert.alert('Backup saved', 'A dated snapshot is in the app-private .rupeeflow/backups directory.'); })} /><Button label="Export JSON to a folder" onPress={() => run(async () => { if (await exportBackup(c.state)) Alert.alert('Exported'); })} /><Button label="Restore JSON backup" onPress={() => run(async () => {
      const pick = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (pick.canceled || !pick.assets[0]) return;
      const restored = validate(JSON.parse(await FS.readAsStringAsync(pick.assets[0].uri)));
      Alert.alert('Replace this ledger?', 'A private backup of the current data will be saved before restoring. Captured phone messages may be merged again on refresh.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', onPress: () => run(async () => { await backup(c.state); await c.mutate(() => ({ ...restored, checkpoint: 0 })); await c.sync(); }) }]);
    })} /></Card>
    <Card><Text style={S.h}>Android access</Text><Text style={S.muted}>On iQOO, allow background activity/autostart for RupeeFlow if alerts stop arriving. Force-stopping an app stops capture until you reopen it. SMS history can recover missed SMS; dismissed notifications cannot be recovered.</Text><Button label="Open Android app settings" onPress={() => run(async () => { if (!native) throw new Error('Install the Android APK'); await native.openAppSettings(); })} /></Card>
  </Page>;
}

export function EntryDetail({ entry: e, c, close }: { entry?: Entry; c: Controller; close: () => void }) {
  if (!e) return null;
  return <Modal transparent visible onRequestClose={close}><View style={S.shade}><ScrollView style={S.sheet} contentContainerStyle={{ paddingBottom: 20 }}><Text style={S.h}>{e.merchant}</Text><Text style={[S.money, { color: e.kind === 'credit' ? C.green : C.red }]}>{sign(e)}</Text><Text style={S.muted}>{pretty(e.at)} · {e.app}{e.bank ? ` · ${e.bank}` : ''}{e.account ? ` · ••${e.account}` : ''}</Text>
    <Text style={S.section}>Category</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{categories.map((category: Category) => <Pressable key={category} onPress={() => run(() => c.mutate(s => ({ ...s, entries: s.entries.map(v => v.id === e.id ? { ...v, category } : v) })))} style={[S.pill, e.category === category && { borderColor: C.cyan }]}><Text style={S.text}>{category}</Text></Pressable>)}</View>
    <Text style={S.section}>Original alert</Text><Text selectable style={S.muted}>{e.raw}</Text><Text style={[S.muted, { marginTop: 12 }]}>Reference: {e.reference || 'Not supplied'} · {e.eventIds.length} linked alert(s)</Text>
    <Button label={e.excluded ? 'Confirm as a separate transaction' : 'Exclude from totals'} onPress={() => run(async () => { await c.mutate(s => ({ ...s, entries: s.entries.map(v => v.id === e.id ? { ...v, excluded: !v.excluded, possibleDuplicate: false } : v) })); close(); })} />
    {e.possibleDuplicate && <Button label="Confirm duplicate · keep excluded" onPress={() => run(async () => { await c.mutate(s => ({ ...s, entries: s.entries.map(v => v.id === e.id ? { ...v, excluded: true, possibleDuplicate: false } : v) })); close(); })} />}
    <Button label="Close" onPress={close} /></ScrollView></View></Modal>;
}
