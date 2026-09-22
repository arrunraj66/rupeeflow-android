import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Alarm, AppState, Priority, Task, Track } from '../types';
import { emptyState, loadState, saveState } from '../lib/storage';
import { cancelNotifications, cancelWakeAlarm, configureNotifications, scheduleAlarm, scheduleTaskReminder } from '../lib/notifications';
import { makeId } from '../lib/date';

type AddTaskInput = Pick<Task, 'title' | 'notes' | 'dueAt' | 'priority'>;
type AddAlarmInput = Pick<Alarm, 'label' | 'hour' | 'minute' | 'days'>;

type DayflowValue = AppState & {
  ready: boolean;
  addTask(input: AddTaskInput): Promise<void>;
  toggleTask(id: string): Promise<void>;
  removeTask(id: string): Promise<void>;
  addAlarm(input: AddAlarmInput): Promise<void>;
  toggleAlarm(id: string): Promise<void>;
  removeAlarm(id: string): Promise<void>;
  addTrack(track: Omit<Track, 'id'>): void;
  removeTrack(id: string): void;
};

const DayflowContext = createContext<DayflowValue | null>(null);

export function DayflowProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      setState(await loadState());
      await configureNotifications().catch(console.warn);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) void saveState(state);
  }, [ready, state]);

  const value = useMemo<DayflowValue>(() => ({
    ...state,
    ready,
    async addTask(input) {
      const task: Task = { ...input, id: makeId(), completed: false };
      task.notificationId = await scheduleTaskReminder(task).catch(() => undefined);
      setState((current) => ({ ...current, tasks: [...current.tasks, task] }));
    },
    async toggleTask(id) {
      const task = state.tasks.find((item) => item.id === id);
      if (task?.notificationId && !task.completed) await cancelNotifications([task.notificationId]).catch(console.warn);
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === id ? { ...item, completed: !item.completed, notificationId: undefined } : item),
      }));
    },
    async removeTask(id) {
      const task = state.tasks.find((item) => item.id === id);
      if (task?.notificationId) await cancelNotifications([task.notificationId]).catch(console.warn);
      setState((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== id) }));
    },
    async addAlarm(input) {
      const alarm: Alarm = { ...input, id: makeId(), enabled: true, notificationIds: [] };
      alarm.notificationIds = await scheduleAlarm(alarm);
      setState((current) => ({ ...current, alarms: [...current.alarms, alarm] }));
    },
    async toggleAlarm(id) {
      const alarm = state.alarms.find((item) => item.id === id);
      if (!alarm) return;
      if (alarm.enabled) {
        await cancelWakeAlarm(alarm.id).catch(console.warn);
        await cancelNotifications(alarm.notificationIds).catch(console.warn);
        setState((current) => ({ ...current, alarms: current.alarms.map((item) => item.id === id ? { ...item, enabled: false, notificationIds: [] } : item) }));
      } else {
        const notificationIds = await scheduleAlarm(alarm);
        setState((current) => ({ ...current, alarms: current.alarms.map((item) => item.id === id ? { ...item, enabled: true, notificationIds } : item) }));
      }
    },
    async removeAlarm(id) {
      const alarm = state.alarms.find((item) => item.id === id);
      if (alarm) {
        await cancelWakeAlarm(alarm.id).catch(console.warn);
        await cancelNotifications(alarm.notificationIds).catch(console.warn);
      }
      setState((current) => ({ ...current, alarms: current.alarms.filter((item) => item.id !== id) }));
    },
    addTrack(track) {
      setState((current) => ({ ...current, tracks: [...current.tracks, { ...track, id: makeId() }] }));
    },
    removeTrack(id) {
      setState((current) => ({ ...current, tracks: current.tracks.filter((item) => item.id !== id) }));
    },
  }), [ready, state]);

  return <DayflowContext.Provider value={value}>{children}</DayflowContext.Provider>;
}

export function useDayflow() {
  const value = useContext(DayflowContext);
  if (!value) throw new Error('useDayflow must be used inside DayflowProvider');
  return value;
}

export const priorities: Priority[] = ['Low', 'Medium', 'High'];
