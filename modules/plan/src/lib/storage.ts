import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from '../types';

const KEY = '@dayflow/state/v1';

export const emptyState: AppState = { tasks: [], alarms: [], tracks: [] };

export async function loadState(): Promise<AppState> {
  const value = await AsyncStorage.getItem(KEY);
  if (!value) return emptyState;
  try {
    const parsed = JSON.parse(value) as Partial<AppState>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      alarms: Array.isArray(parsed.alarms) ? parsed.alarms : [],
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
    };
  } catch {
    return emptyState;
  }
}

export const saveState = (state: AppState) => AsyncStorage.setItem(KEY, JSON.stringify(state));
