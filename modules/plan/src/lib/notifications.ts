import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alarm, Task } from '../types';

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
