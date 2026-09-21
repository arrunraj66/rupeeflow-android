import { Linking, Share } from 'react-native';
import { Task } from '../types';

export const integrations = [
  { id: 'calendar', name: 'Google Calendar', icon: 'calendar-outline', color: '#4285F4', url: 'https://calendar.google.com' },
  { id: 'todoist', name: 'Todoist', icon: 'checkmark-circle-outline', color: '#E44332', url: 'todoist://' },
  { id: 'spotify', name: 'Spotify', icon: 'musical-notes-outline', color: '#1DB954', url: 'spotify://' },
  { id: 'slack', name: 'Slack', icon: 'chatbubbles-outline', color: '#611F69', url: 'slack://' },
] as const;

export async function openIntegration(url: string) {
  if (await Linking.canOpenURL(url)) return Linking.openURL(url);
  if (url.endsWith('://')) return Linking.openURL(`https://${url.slice(0, -3)}.com`);
  return Linking.openURL(url);
}

export async function shareTask(task: Task) {
  const when = new Date(task.dueAt).toLocaleString();
  return Share.share({ message: `${task.title}\n${when}${task.notes ? `\n${task.notes}` : ''}` });
}

export async function addTaskToGoogleCalendar(task: Task) {
  const start = new Date(task.dueAt);
  const end = new Date(start.getTime() + 30 * 60_000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    details: task.notes,
    dates: `${stamp(start)}/${stamp(end)}`,
  });
  return Linking.openURL(`https://calendar.google.com/calendar/render?${query}`);
}
