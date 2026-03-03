export type TraitKey =
  | 'discipline'
  | 'selfControl'
  | 'emotionalStability'
  | 'awareness'
  | 'responsibility'
  | 'confidence';

export type TraitScores = Record<TraitKey, number>;

export type StartedTiming = 'early' | 'on_time' | 'late';
export type DayPeriod = 'morning' | 'day' | 'evening';

export interface DailyMark {
  date: string;
  completedQuest: boolean;
  resistance: 1 | 2 | 3 | 4 | 5 | null;
  startedOnTime: StartedTiming | null;
  obstacle: string | null;
  period: DayPeriod | null;
}

export interface TraitHistoryPoint {
  date: string;
  traits: TraitScores;
}

export interface CheckpointSummary {
  windowDays: 3 | 7 | 30;
  completedQuests: number;
  totalDays: number;
  averageResistance: number | null;
  mostCommonObstacle: string | null;
  bestPeriod: DayPeriod | null;
  recommendation: string;
}

export interface TrendPoint {
  date: string;
  resistance: number;
  onTimeRate: number;
  stability: number;
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  tone: 'neutral' | 'positive' | 'recovery';
}

export interface ProgressData {
  hasPracticeData: boolean;
  currentFocus: string;
  chapterDay: number | null;
  chapterLength: number;
  chapterProgressPercent: number;
  daysToNextCheckpoint: number | null;
  milestones: Array<3 | 7 | 30>;
  traits: TraitScores;
  traitHistory: TraitHistoryPoint[];
  dailyMarks: DailyMark[];
  summary3d: CheckpointSummary | null;
  summary7d: CheckpointSummary | null;
  trend: TrendPoint[];
  events: TimelineEvent[];
}
