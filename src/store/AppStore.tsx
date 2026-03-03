import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { todayIso, updateTraits } from '../domain/app/logic';
import { AppState, DailyLogEntry, ProgramState, Traits, UserProfile } from '../domain/app/types';

const APP_STATE_STORAGE_KEY = '@character_plus/app_state_v1';

const BASE_TRAITS: Traits = {
  discipline: 0,
  selfControl: 0,
  emotionalStability: 0,
  awareness: 0,
  responsibility: 0,
  confidence: 0,
};

const INITIAL_STATE: AppState = {
  onboardingCompleted: false,
  user: {
    name: '',
    gender: 'male',
    motivationTags: [],
    motivationPhrase: '',
    motivationPhotoUri: '',
  },
  program: {
    selectedDirections: [],
    activeDirection: '',
    chapterStartDate: todayIso(),
    chapterLengthDays: 30,
  },
  logs: [],
  traits: BASE_TRAITS,
  disciplineTechniquesSelected: [],
  disciplineTechniquesActive: [],
  hasChosenTechniques: false,
  hasSeenTechniquesIntro: false,
};

type OnboardingPayload = {
  user: UserProfile;
  program: Pick<ProgramState, 'selectedDirections' | 'activeDirection'> & Partial<Pick<ProgramState, 'chapterLengthDays'>>;
};

type CompleteTodayQuestPayload = Omit<DailyLogEntry, 'date' | 'questCompleted'>;

type AppStateAction =
  | { type: 'HYDRATE'; payload: AppState }
  | { type: 'COMPLETE_ONBOARDING'; payload: OnboardingPayload }
  | { type: 'ADD_OR_UPDATE_DAILY_LOG'; payload: DailyLogEntry }
  | { type: 'COMPLETE_TODAY_QUEST'; payload: CompleteTodayQuestPayload }
  | { type: 'SET_ACTIVE_DIRECTION'; payload: string }
  | { type: 'SELECT_TECHNIQUE'; payload: string }
  | { type: 'UNSELECT_TECHNIQUE'; payload: string }
  | { type: 'SET_ACTIVE_TECHNIQUE'; payload: { id: string; active: boolean } }
  | { type: 'SET_HAS_CHOSEN_TECHNIQUES'; payload: boolean }
  | { type: 'SET_HAS_SEEN_TECHNIQUES_INTRO'; payload: boolean }
  | { type: 'RESET_ALL_DATA' };

interface AppStoreValue {
  state: AppState;
  isHydrated: boolean;
  completeOnboarding: (payload: OnboardingPayload) => void;
  addOrUpdateDailyLog: (entry: DailyLogEntry) => void;
  completeTodayQuest: (payload: CompleteTodayQuestPayload) => void;
  setActiveDirection: (direction: string) => void;
  selectTechnique: (id: string) => void;
  unselectTechnique: (id: string) => void;
  setActiveTechnique: (id: string, active: boolean) => boolean;
  setHasChosenTechniques: (value: boolean) => void;
  setHasSeenTechniquesIntro: (value: boolean) => void;
  resetAllData: () => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function sortLogsByDate(logs: DailyLogEntry[]): DailyLogEntry[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

function recalculateTraits(logs: DailyLogEntry[], activeDirection: string): Traits {
  return sortLogsByDate(logs).reduce((traits, log) => updateTraits(traits, log, activeDirection), BASE_TRAITS);
}

function upsertLog(logs: DailyLogEntry[], entry: DailyLogEntry): DailyLogEntry[] {
  const exists = logs.some((item) => item.date === entry.date);
  if (exists) {
    return logs.map((item) => (item.date === entry.date ? entry : item));
  }
  return [...logs, entry];
}

function appStateReducer(state: AppState, action: AppStateAction): AppState {
  if (action.type === 'HYDRATE') {
    return action.payload;
  }

  if (action.type === 'COMPLETE_ONBOARDING') {
    const today = todayIso();
    const selectedDirections = action.payload.program.selectedDirections;
    const activeDirection = action.payload.program.activeDirection || selectedDirections[0] || '';

    const nextProgram: ProgramState = {
      selectedDirections,
      activeDirection,
      chapterStartDate: today,
      chapterLengthDays: action.payload.program.chapterLengthDays ?? 30,
    };

    return {
      ...state,
      onboardingCompleted: true,
      user: action.payload.user,
      program: nextProgram,
      logs: [],
      traits: BASE_TRAITS,
      disciplineTechniquesSelected: [],
      disciplineTechniquesActive: [],
      hasChosenTechniques: false,
      hasSeenTechniquesIntro: false,
    };
  }

  if (action.type === 'ADD_OR_UPDATE_DAILY_LOG') {
    const nextLogs = upsertLog(state.logs, action.payload);
    return {
      ...state,
      logs: nextLogs,
      traits: recalculateTraits(nextLogs, state.program.activeDirection),
    };
  }

  if (action.type === 'COMPLETE_TODAY_QUEST') {
    const today = todayIso();
    const entry: DailyLogEntry = {
      date: today,
      questCompleted: true,
      startedOnTime: action.payload.startedOnTime,
      resistance: action.payload.resistance,
      obstacles: action.payload.obstacles,
      reflectionText: action.payload.reflectionText,
      usedTechniqueId: action.payload.usedTechniqueId,
    };

    const nextLogs = upsertLog(state.logs, entry);
    return {
      ...state,
      logs: nextLogs,
      traits: recalculateTraits(nextLogs, state.program.activeDirection),
    };
  }

  if (action.type === 'SET_ACTIVE_DIRECTION') {
    return {
      ...state,
      program: {
        ...state.program,
        activeDirection: action.payload,
      },
    };
  }

  if (action.type === 'SELECT_TECHNIQUE') {
    if (state.disciplineTechniquesSelected.includes(action.payload)) {
      return state;
    }
    return {
      ...state,
      disciplineTechniquesSelected: [...state.disciplineTechniquesSelected, action.payload],
    };
  }

  if (action.type === 'UNSELECT_TECHNIQUE') {
    return {
      ...state,
      disciplineTechniquesSelected: state.disciplineTechniquesSelected.filter((id) => id !== action.payload),
      disciplineTechniquesActive: state.disciplineTechniquesActive.filter((id) => id !== action.payload),
    };
  }

  if (action.type === 'SET_ACTIVE_TECHNIQUE') {
    const { id, active } = action.payload;
    if (!active) {
      return {
        ...state,
        disciplineTechniquesActive: state.disciplineTechniquesActive.filter((item) => item !== id),
      };
    }

    if (state.disciplineTechniquesActive.includes(id)) {
      return state;
    }

    if (state.disciplineTechniquesActive.length >= 3) {
      return state;
    }

    const nextSelected = state.disciplineTechniquesSelected.includes(id)
      ? state.disciplineTechniquesSelected
      : [...state.disciplineTechniquesSelected, id];

    return {
      ...state,
      disciplineTechniquesSelected: nextSelected,
      disciplineTechniquesActive: [...state.disciplineTechniquesActive, id],
    };
  }

  if (action.type === 'SET_HAS_CHOSEN_TECHNIQUES') {
    return {
      ...state,
      hasChosenTechniques: action.payload,
    };
  }

  if (action.type === 'SET_HAS_SEEN_TECHNIQUES_INTRO') {
    return {
      ...state,
      hasSeenTechniquesIntro: action.payload,
    };
  }

  if (action.type === 'RESET_ALL_DATA') {
    return {
      ...INITIAL_STATE,
      program: {
        ...INITIAL_STATE.program,
        chapterStartDate: todayIso(),
      },
    };
  }

  return state;
}

function normalizeStoredState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Partial<AppState>;

  if (!data.user || !data.program || !data.traits || !Array.isArray(data.logs)) {
    return null;
  }

  const selectedTechniques = Array.isArray(data.disciplineTechniquesSelected)
    ? data.disciplineTechniquesSelected.filter((item): item is string => typeof item === 'string')
    : [];
  const activeTechniques = Array.isArray(data.disciplineTechniquesActive)
    ? data.disciplineTechniquesActive
        .filter((item): item is string => typeof item === 'string')
        .filter((item) => selectedTechniques.includes(item))
        .slice(0, 3)
    : [];

  return {
    onboardingCompleted: data.onboardingCompleted === true,
    user: {
      name: typeof data.user.name === 'string' ? data.user.name : '',
      gender: data.user.gender === 'female' ? 'female' : 'male',
      motivationTags: Array.isArray(data.user.motivationTags)
        ? data.user.motivationTags.filter((item): item is string => typeof item === 'string')
        : [],
      motivationPhrase: typeof data.user.motivationPhrase === 'string' ? data.user.motivationPhrase : '',
      motivationPhotoUri: typeof data.user.motivationPhotoUri === 'string' ? data.user.motivationPhotoUri : '',
    },
    program: {
      selectedDirections: Array.isArray(data.program.selectedDirections)
        ? data.program.selectedDirections.filter((item): item is string => typeof item === 'string')
        : [],
      activeDirection: typeof data.program.activeDirection === 'string' ? data.program.activeDirection : '',
      chapterStartDate: typeof data.program.chapterStartDate === 'string' ? data.program.chapterStartDate : todayIso(),
      chapterLengthDays: typeof data.program.chapterLengthDays === 'number' ? data.program.chapterLengthDays : 30,
    },
    logs: data.logs.filter((item): item is DailyLogEntry => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const value = item as Partial<DailyLogEntry>;
      return (
        typeof value.date === 'string' &&
        typeof value.questCompleted === 'boolean' &&
        (value.startedOnTime === 'on_time' || value.startedOnTime === 'late' || value.startedOnTime === 'very_late') &&
        (value.resistance === 1 ||
          value.resistance === 2 ||
          value.resistance === 3 ||
          value.resistance === 4 ||
          value.resistance === 5) &&
        Array.isArray(value.obstacles)
      );
    }),
    traits: {
      discipline: typeof data.traits.discipline === 'number' ? data.traits.discipline : 0,
      selfControl: typeof data.traits.selfControl === 'number' ? data.traits.selfControl : 0,
      emotionalStability: typeof data.traits.emotionalStability === 'number' ? data.traits.emotionalStability : 0,
      awareness: typeof data.traits.awareness === 'number' ? data.traits.awareness : 0,
      responsibility: typeof data.traits.responsibility === 'number' ? data.traits.responsibility : 0,
      confidence: typeof data.traits.confidence === 'number' ? data.traits.confidence : 0,
    },
    disciplineTechniquesSelected: selectedTechniques,
    disciplineTechniquesActive: activeTechniques,
    hasChosenTechniques: data.hasChosenTechniques === true,
    hasSeenTechniquesIntro: data.hasSeenTechniquesIntro === true,
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        const raw = await AsyncStorage.getItem(APP_STATE_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        const normalized = normalizeStoredState(parsed);
        if (normalized) {
          dispatch({ type: 'HYDRATE', payload: normalized });
        }
      } finally {
        setIsHydrated(true);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    void AsyncStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
  }, [isHydrated, state]);

  const value = useMemo<AppStoreValue>(
    () => ({
      state,
      isHydrated,
      completeOnboarding: (payload) => dispatch({ type: 'COMPLETE_ONBOARDING', payload }),
      addOrUpdateDailyLog: (entry) => dispatch({ type: 'ADD_OR_UPDATE_DAILY_LOG', payload: entry }),
      completeTodayQuest: (payload) => dispatch({ type: 'COMPLETE_TODAY_QUEST', payload }),
      setActiveDirection: (direction) => dispatch({ type: 'SET_ACTIVE_DIRECTION', payload: direction }),
      selectTechnique: (id) => dispatch({ type: 'SELECT_TECHNIQUE', payload: id }),
      unselectTechnique: (id) => dispatch({ type: 'UNSELECT_TECHNIQUE', payload: id }),
      setActiveTechnique: (id, active) => {
        if (active && !state.disciplineTechniquesActive.includes(id) && state.disciplineTechniquesActive.length >= 3) {
          return false;
        }
        dispatch({ type: 'SET_ACTIVE_TECHNIQUE', payload: { id, active } });
        return true;
      },
      setHasChosenTechniques: (value) => dispatch({ type: 'SET_HAS_CHOSEN_TECHNIQUES', payload: value }),
      setHasSeenTechniquesIntro: (value) => dispatch({ type: 'SET_HAS_SEEN_TECHNIQUES_INTRO', payload: value }),
      resetAllData: () => dispatch({ type: 'RESET_ALL_DATA' }),
    }),
    [isHydrated, state],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }
  return context;
}
