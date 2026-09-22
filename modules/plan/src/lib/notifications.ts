import { NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alarm, Task } from '../types';

type WakeAlarmStatus = { exact: boolean; notifications: boolean; fullScreen: boolean };
type WakeAlarmNative = {
  schedule(id: string, label: string, hour: number, minute: number, days: number[]): Promise<number>;
  cancel(id: string): Promise<void>;
  status(): Promise<WakeAlarmStatus>;
  openSettings(kind: 'exact' | 'fullScreen'): Promise<void>;
  test(): Promise<void>;
};

const wakeAlarm = NativeModules.WakeAlarm as WakeAlarmNative | undefined;

export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarms', {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 250, 600],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync('tasks', {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
  return Notifications.requestPermissionsAsync();
}

export async function scheduleTaskReminder(task: Task) {
  const date = new Date(task.dueAt);
  if (date.getTime() <= Date.now()) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Up next · ${task.title}`,
      body: task.notes || 'This task is scheduled now.',
      sound: 'default',
      data: { kind: 'task', id: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'tasks',
    },
  });
}

export async function scheduleAlarm(alarm: Alarm) {
  if (Platform.OS === 'android') {
    if (!wakeAlarm) throw new Error('Wake-up alarm service is unavailable in this build.');
    await wakeAlarm.schedule(alarm.id, alarm.label || 'Wake-up alarm', alarm.hour, alarm.minute, alarm.days);
    return [alarm.id];
  }
  const identifiers: string[] = [];
  if (alarm.days.length === 0) {
    const date = new Date();
    date.setHours(alarm.hour, alarm.minute, 0, 0);
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
    identifiers.push(
      await Notifications.scheduleNotificationAsync({
        content: alarmContent(alarm),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: 'alarms',
        },
      }),
    );
  } else {
    for (const day of alarm.days) {
      identifiers.push(
        await Notifications.scheduleNotificationAsync({
          content: alarmContent(alarm),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1,
            hour: alarm.hour,
            minute: alarm.minute,
            channelId: 'alarms',
          },
        }),
      );
    }
  }
  return identifiers;
}

function alarmContent(alarm: Alarm) {
  return {
    title: alarm.label || 'Dayflow alarm',
    body: 'Your schedule is calling.',
    sound: 'default' as const,
    priority: Notifications.AndroidNotificationPriority.MAX,
    data: { kind: 'alarm', id: alarm.id },
  };
}

export async function cancelNotifications(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function cancelWakeAlarm(id: string) {
  if (Platform.OS === 'android' && wakeAlarm) await wakeAlarm.cancel(id);
}

export async function getWakeAlarmStatus(): Promise<WakeAlarmStatus> {
  if (Platform.OS !== 'android' || !wakeAlarm) return { exact: true, notifications: true, fullScreen: true };
  return wakeAlarm.status();
}

export async function openWakeAlarmSettings(kind: 'exact' | 'fullScreen') {
  if (Platform.OS === 'android' && wakeAlarm) await wakeAlarm.openSettings(kind);
}

export async function testWakeAlarm() {
  if (Platform.OS !== 'android' || !wakeAlarm) throw new Error('Alarm testing is available on Android.');
  await wakeAlarm.test();
}
