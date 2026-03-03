export type StartTiming = 'early' | 'onTime' | 'late';

export type ReflectionObstacle = 'phone' | 'fatigue' | 'chaos' | 'perfectionism';

export interface MotivationBeacon {
  title: string;
  subtitle: string;
  avatarUri?: string;
  initials?: string;
}

export interface DailyFocus {
  title: string;
  description: string;
  dayInChapter: number | null;
  chapterLength: number;
}

export interface Technique {
  title: string;
  whyItWorks: string;
  steps: string[];
}

export interface DailyQuest {
  text: string;
  defaultMinutes: number;
  allowedDurations: number[];
}

export interface CheckpointInfo {
  daysToNextCheckpoint: number | null;
  reportCadenceDays: number[];
}

export interface ProgramData {
  beacon: MotivationBeacon | null;
  focus: DailyFocus | null;
  technique: Technique | null;
  dailyQuest: DailyQuest | null;
  checkpoint: CheckpointInfo | null;
  questCompletedToday: boolean;
}

export interface ReflectionAnswers {
  resistance: 1 | 2 | 3 | 4 | 5 | null;
  startedOnTime: StartTiming | null;
  obstacles: ReflectionObstacle[];
}
