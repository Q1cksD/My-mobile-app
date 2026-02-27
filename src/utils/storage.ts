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
    isPremium: false,
  },
  settingsBlocks: [
    { id: 'traits', kind: 'traits', title: 'Черты характера', color: '#eef4ff' },
    { id: 'emotions', kind: 'emotions', title: 'Эмоции', color: '#eefaf5' },
    { id: 'habits', kind: 'habits', title: 'Привычки', color: '#fff8eb' },
    { id: 'values', kind: 'values', title: 'Ценности и убеждения', color: '#f5f0ff' },
  ],
  sectionNotes: {
    emotions: '',
    habits: '',
    values: '',
  },
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const parsedBlocks =
      parsed.settingsBlocks && parsed.settingsBlocks.length > 0 ? parsed.settingsBlocks : defaultState.settingsBlocks;

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
      settingsBlocks: parsedBlocks,
      sectionNotes: {
        ...defaultState.sectionNotes,
        ...parsed.sectionNotes,
      },
    };
  } catch {
    return defaultState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
