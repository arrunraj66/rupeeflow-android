// One serialized mutation queue prevents background import from overwriting a simultaneous UI edit.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { emptyLedger, Ledger } from './model';
import { ingest } from './ledger';
import { load, save } from './storage';
import { CaptureStatus, native } from './capture';

export function useLedger() {
  const [state, setState] = useState<Ledger>(emptyLedger);
  const ref = useRef(state);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CaptureStatus>();
  const queue = useRef(Promise.resolve());
  const syncing = useRef(false);
  const mutate = useCallback((change: (s: Ledger) => Ledger) => {
    const next = queue.current.then(async () => {
      const value = change(ref.current);
      await save(value);
      ref.current = value; setState(value);
    });
    queue.current = next.catch(e => { setError(String(e)); });
    return next;
  }, []);
  useEffect(() => { void load().then(value => { ref.current = value; setState(value); setReady(true); }).catch(e => setError(String(e))); }, []);
  const sync = useCallback(async (since?: number) => {
    if (!ready || !native || syncing.current) return;
    syncing.current = true; setBusy(true);
    try {
      const current = await native.status(); setStatus(current);
      // On foreground recover missed SMS (including OEM background restrictions) with a 24-hour overlap.
      if (current.smsEnabled && current.smsPermission) await native.scanSms(since ?? Math.max(0, (ref.current.lastSync ?? Date.now()) - 86400000));
      let page = await native.events(ref.current.checkpoint);
      while (page.length) {
        const batch = page;
        await mutate(s => ingest(s, batch));
        page = await native.events(ref.current.checkpoint);
      }
      setError('');
    } catch (e) { setError(String(e)); }
    finally { syncing.current = false; setBusy(false); }
  }, [ready, mutate]);
  useEffect(() => {
    if (!ready) return;
    void sync();
    const sub = AppState.addEventListener('change', value => { if (value === 'active') void sync(); });
    // Events are durable in native SQLite while the app is closed; only active UI polls for updates.
    const timer = setInterval(() => { if (AppState.currentState === 'active' && native && !syncing.current) {
      void native.events(ref.current.checkpoint).then(async events => { if (events.length) await mutate(s => ingest(s, events)); }).catch(e => setError(String(e)));
    } }, 4000);
    return () => { sub.remove(); clearInterval(timer); };
  }, [ready, sync, mutate]);
  return { state, ready, error, busy, status, mutate, sync };
}
