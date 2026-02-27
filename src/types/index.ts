export type GoalCategory = 'calmness' | 'discipline' | 'kindness' | 'focus' | 'punctuality';

export interface GoalTemplate {
  id: GoalCategory;
  title: string;
  description: string;
  reminders: string[];
}

export interface UserGoal {
  id: string;
  category: GoalCategory;
  customAction: string;
  isActive: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  timesPerDay: number;
  startHour: number;
  endHour: number;
}

export interface DailyCheckin {
  date: string;
  score: number;
  note: string;
}

export interface UserProfile {
  name: string;
  onboardingCompleted: boolean;
  isPremium: boolean;
}

export type SettingsBlockKind = 'traits' | 'emotions' | 'habits' | 'values' | 'custom';

export interface SettingsBlock {
  id: string;
  kind: SettingsBlockKind;
  title: string;
  color: string;
}

export type ReminderMode = 'fixed' | 'random';
export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface FixedTaskReminder {
  mode: 'fixed';
  weekdays: WeekdayKey[];
  times: string[];
}

export interface RandomTaskReminder {
  mode: 'random';
  weekdays: WeekdayKey[];
  startHour: number;
  endHour: number;
  timesInWindow: number;
}

export interface TaskReminderSettings {
  enabled: boolean;
  config: FixedTaskReminder | RandomTaskReminder;
}

export interface BlockTask {
  id: string;
  title: string;
  description: string;
  motivation: string;
  motivationImageUri: string;
  reminders: TaskReminderSettings;
}

export interface AppState {
  goals: UserGoal[];
  reminderSettings: ReminderSettings;
  checkins: DailyCheckin[];
  profile: UserProfile;
  settingsBlocks: SettingsBlock[];
  sectionNotes: Record<string, string>;
  sectionTasks: Record<string, BlockTask[]>;
}
