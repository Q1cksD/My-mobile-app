import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from '../types';

const KEY = 'character_plus_state_v1';

export const defaultState: AppState = {
  goals: [],
  reminderSettings: {
    enabled: false,
    timesPerDay: 3,
    startHour: 9,
    endHour: 21,
  },
  checkins: [],
  profile: {
    name: '',
    onboardingCompleted: false,
  },
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as AppState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...defaultState,
      ...parsed,
      reminderSettings: {
        ...defaultState.reminderSettings,
        ...parsed.reminderSettings,
      },
      profile: {
        ...defaultState.profile,
        ...parsed.profile,
      },
      goals: parsed.goals ?? [],
      checkins: parsed.checkins ?? [],
    };
  } catch {
    return defaultState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}