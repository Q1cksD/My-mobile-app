import { dayDiffInclusive, todayIso } from '../domain/app/logic';
import { AppState, DailyLogEntry, StartedOnTime, TraitKey, Traits } from '../domain/app/types';

export interface ProgressSummary {
  windowDays: 3 | 7 | 30;
  completed: number;
  total: number;
  averageResistance: number | null;
  topObstacle: string | null;
  onTimeRate: number;
}

export interface TrendPoint {
  date: string;
  resistance: number;
  completion: number;
  stability: number;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  tone: 'neutral' | 'positive' | 'recovery';
}

export type ArchetypeName = 'Собранный' | 'Устойчивый' | 'Практик' | 'Волевой' | 'Формируется';

export interface CharacterInsight {
  archetypeName: ArchetypeName;
  archetypeDescription: string;
  level: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  topTraits: Array<{ key: TraitKey; value: number }>;
  bottomTraits: Array<{ key: TraitKey; value: number }>;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T00:00:00`);
  value.setDate(value.getDate() - days);
  return toIsoDate(value);
}

function daysBetween(olderIso: string, newerIso: string): number {
  const older = new Date(`${olderIso}T00:00:00`);
  const newer = new Date(`${newerIso}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((newer.getTime() - older.getTime()) / msPerDay));
}

function logsSortedAsc(logs: DailyLogEntry[]): DailyLogEntry[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

function logsSortedDesc(logs: DailyLogEntry[]): DailyLogEntry[] {
  return [...logs].sort((a, b) => b.date.localeCompare(a.date));
}

function countBy<T extends string>(items: T[]): Map<T, number> {
  return items.reduce((acc, item) => {
    acc.set(item, (acc.get(item) ?? 0) + 1);
    return acc;
  }, new Map<T, number>());
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const result = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(result.toFixed(1));
}

function chooseTopKey<T extends string>(map: Map<T, number>): T | null {
  let winner: T | null = null;
  let max = 0;
  map.forEach((count, key) => {
    if (count > max) {
      max = count;
      winner = key;
    }
  });
  return winner;
}

function onTimeScore(value: StartedOnTime): number {
  if (value === 'on_time') {
    return 1;
  }
  if (value === 'late') {
    return 0.4;
  }
  return 0.1;
}

function stableDay(log: DailyLogEntry): boolean {
  return log.questCompleted && log.resistance <= 3 && log.startedOnTime !== 'very_late';
}

export function getTodayLog(state: AppState): DailyLogEntry | null {
  const today = todayIso();
  return state.logs.find((item) => item.date === today) ?? null;
}

export function getDayInChapter(state: AppState): number {
  return Math.max(1, dayDiffInclusive(state.program.chapterStartDate, todayIso()));
}

export function getDaysToNextCheckpoint(state: AppState): number {
  const day = getDayInChapter(state);
  const milestones = [3, 7, 30];
  const next = milestones.find((item) => item >= day);
  if (!next) {
    return 0;
  }
  return Math.max(0, next - day);
}

export function getRecentLogs(state: AppState, days: number): DailyLogEntry[] {
  const today = todayIso();
  const fromDate = subtractDays(today, days - 1);
  return state.logs.filter((item) => item.date >= fromDate && item.date <= today);
}

export function getProgressSummary(state: AppState, windowDays: 3 | 7 | 30): ProgressSummary {
  const recent = getRecentLogs(state, windowDays);
  const completed = recent.filter((item) => item.questCompleted);
  const obstacles = completed.flatMap((item) => item.obstacles);
  const resistances = completed.map((item) => item.resistance);
  const onTimeCompleted = completed.filter((item) => item.startedOnTime === 'on_time').length;
  const onTimeRate = completed.length ? Math.round((onTimeCompleted / completed.length) * 100) : 0;

  return {
    windowDays,
    completed: completed.length,
    total: windowDays,
    averageResistance: average(resistances),
    topObstacle: chooseTopKey(countBy(obstacles)),
    onTimeRate,
  };
}

export function getProgressTrend(state: AppState, days = 14): TrendPoint[] {
  const today = todayIso();
  const fromDate = subtractDays(today, days - 1);
  const rangeDates: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    rangeDates.push(subtractDays(today, i));
  }

  const logsByDate = new Map(state.logs.map((item) => [item.date, item]));
  const sorted = logsSortedAsc(state.logs);

  return rangeDates
    .filter((date) => date >= fromDate)
    .map((date) => {
      const log = logsByDate.get(date);
      const trailingWeek = sorted.filter((entry) => entry.date <= date).slice(-7);
      const stableCount = trailingWeek.filter(stableDay).length;
      const stability = trailingWeek.length ? Math.round((stableCount / trailingWeek.length) * 100) : 0;

      return {
        date,
        resistance: log?.resistance ?? 0,
        completion: log?.questCompleted ? 100 : 0,
        stability,
      };
    });
}

export function getTimeline(state: AppState, limit = 10): TimelineEvent[] {
  const logs = logsSortedDesc(state.logs);
  const events: TimelineEvent[] = [];

  logs.forEach((log, index) => {
    if (log.questCompleted) {
      events.push({
        id: `${log.date}-done`,
        date: log.date,
        title: 'День закрыт',
        tone: 'positive',
      });
    } else {
      events.push({
        id: `${log.date}-miss`,
        date: log.date,
        title: 'Пропуск -> перезапуск',
        tone: 'recovery',
      });
    }

    if (index > 0 && log.questCompleted && index % 3 === 0) {
      events.push({
        id: `${log.date}-milestone`,
        date: log.date,
        title: 'Этап прогресса отмечен',
        tone: 'neutral',
      });
    }

    const newerLogDate = logs[index - 1]?.date;
    if (newerLogDate && daysBetween(log.date, newerLogDate) > 1) {
      events.push({
        id: `${log.date}-restart`,
        date: log.date,
        title: 'Пропуск -> перезапуск',
        tone: 'recovery',
      });
    }
  });

  return events.slice(0, limit);
}

export function getWeeklyStability(state: AppState): { stableDays: number; relapses: number } {
  const recent = getRecentLogs(state, 7);
  const stableDays = recent.filter(stableDay).length;
  const relapses = recent.filter((item) => !item.questCompleted).length;
  return { stableDays, relapses };
}

function deriveArchetype(traits: Traits): { name: ArchetypeName; description: string } {
  if (traits.discipline >= 60 && traits.responsibility >= 58) {
    return {
      name: 'Собранный',
      description: 'Ты держишь курс через действие и ответственность.',
    };
  }

  if (traits.emotionalStability >= 58 && traits.awareness >= 56) {
    return {
      name: 'Устойчивый',
      description: 'Ты замечаешь состояние и сохраняешь внутреннюю опору.',
    };
  }

  const values = Object.values(traits);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg >= 45) {
    return {
      name: 'Практик',
      description: 'Ты стабильно набираешь форму через ежедневный ритм.',
    };
  }

  if (traits.selfControl >= 55 || traits.confidence >= 55) {
    return {
      name: 'Волевой',
      description: 'Ты укрепляешь характер через выбор в пользу действия.',
    };
  }

  return {
    name: 'Формируется',
    description: 'Сделай первые шаги — профиль характера начнет проявляться.',
  };
}

export function getCharacterInsight(state: AppState): CharacterInsight {
  const traitEntries = (Object.entries(state.traits) as Array<[TraitKey, number]>).sort((a, b) => b[1] - a[1]);
  const topTraits = traitEntries.slice(0, 2).map(([key, value]) => ({ key, value: Math.round(value) }));
  const bottomTraits = [...traitEntries]
    .reverse()
    .slice(0, 2)
    .map(([key, value]) => ({ key, value: Math.round(value) }));

  const weeklyLogs = getRecentLogs(state, 7);
  const monthlyLogs = getRecentLogs(state, 30);

  const weeklyCompleted = weeklyLogs.filter((item) => item.questCompleted).length;
  const monthlyCompleted = monthlyLogs.filter((item) => item.questCompleted).length;
  const weeklyGrowth = weeklyCompleted;
  const monthlyGrowth = monthlyCompleted;

  const archetype = deriveArchetype(state.traits);
  const avgScore = Object.values(state.traits).reduce((sum, value) => sum + value, 0) / 6;
  const level = Math.max(1, Math.round(avgScore / 7));

  return {
    archetypeName: archetype.name,
    archetypeDescription: archetype.description,
    level,
    weeklyGrowth,
    monthlyGrowth,
    topTraits,
    bottomTraits,
  };
}

export const TRAIT_LABELS: Record<TraitKey, string> = {
  discipline: 'Дисциплина',
  selfControl: 'Самоконтроль',
  emotionalStability: 'Эмоциональная устойчивость',
  awareness: 'Осознанность',
  responsibility: 'Ответственность',
  confidence: 'Уверенность',
};
