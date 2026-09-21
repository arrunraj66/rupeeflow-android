export const pad = (value: number) => String(value).padStart(2, '0');

export const formatTime = (dateValue: string | Date) =>
  new Date(dateValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDay = (dateValue: string | Date) => {
  const date = new Date(dateValue);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const nextDateAt = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date;
};

export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
