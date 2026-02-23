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

export interface AppState {
  goals: UserGoal[];
  reminderSettings: ReminderSettings;
  checkins: DailyCheckin[];
  profile: UserProfile;
}
