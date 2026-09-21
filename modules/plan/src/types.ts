export type Priority = 'Low' | 'Medium' | 'High';

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueAt: string;
  completed: boolean;
  priority: Priority;
  notificationId?: string;
};

export type Alarm = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
  days: number[];
  notificationIds: string[];
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  uri: string;
};

export type AppState = {
  tasks: Task[];
  alarms: Alarm[];
  tracks: Track[];
};
