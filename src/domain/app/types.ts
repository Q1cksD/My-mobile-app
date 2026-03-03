export type Gender = 'male' | 'female';

export interface UserProfile {
  name: string;
  gender: Gender;
  motivationTags: string[];
  motivationPhrase: string;
  motivationPhotoUri?: string;
}

export interface ProgramState {
  selectedDirections: string[];
  activeDirection: string;
  chapterStartDate: string;
  chapterLengthDays: number;
}

export type StartedOnTime = 'on_time' | 'late' | 'very_late';

export interface DailyLogEntry {
  date: string;
  questCompleted: boolean;
  startedOnTime: StartedOnTime;
  resistance: 1 | 2 | 3 | 4 | 5;
  obstacles: string[];
  reflectionText?: string;
  usedTechniqueId?: string;
}

export interface Traits {
  discipline: number;
  selfControl: number;
  emotionalStability: number;
  awareness: number;
  responsibility: number;
  confidence: number;
}

export type TraitKey = keyof Traits;

export interface AppState {
  onboardingCompleted: boolean;
  user: UserProfile;
  program: ProgramState;
  logs: DailyLogEntry[];
  traits: Traits;
  disciplineTechniquesSelected: string[];
  disciplineTechniquesActive: string[];
  hasChosenTechniques: boolean;
  hasSeenTechniquesIntro: boolean;
}
