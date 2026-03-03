import {
  CheckpointSummary,
  DailyMark,
  DayPeriod,
  ProgressData,
  StartedTiming,
  TraitHistoryPoint,
  TraitScores,
  TrendPoint,
} from './types';
import { useMockData } from '../mockConfig';

export const useProgressMockData = useMockData;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isoDay(daysAgo: number): string {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - daysAgo);
  return value.toISOString().slice(0, 10);
}

function buildTraitHistory(days = 30): TraitHistoryPoint[] {
  const history: TraitHistoryPoint[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const dayIndex = days - 1 - i;
    const base = 44 + dayIndex * 0.6;

    const traits: TraitScores = {
      discipline: Math.round(clamp(base + Math.sin(dayIndex / 3) * 6 + 15, 0, 100)),
      selfControl: Math.round(clamp(base + Math.cos(dayIndex / 5) * 5 + 10, 0, 100)),
      emotionalStability: Math.round(clamp(base + Math.sin(dayIndex / 6) * 5 + 8, 0, 100)),
      awareness: Math.round(clamp(base + Math.cos(dayIndex / 4) * 4 + 7, 0, 100)),
      responsibility: Math.round(clamp(base + Math.sin(dayIndex / 4) * 4 + 13, 0, 100)),
      confidence: Math.round(clamp(base + Math.cos(dayIndex / 7) * 6 + 5, 0, 100)),
    };

    history.push({ date: isoDay(i), traits });
  }

  return history;
}

function choosePeriod(index: number): DayPeriod {
  const periods: DayPeriod[] = ['morning', 'day', 'evening'];
  return periods[index % periods.length] ?? 'day';
}

function chooseStartedTiming(index: number): StartedTiming {
  const values: StartedTiming[] = ['on_time', 'early', 'late'];
  return values[index % values.length] ?? 'on_time';
}

function chooseObstacle(index: number): string {
  const items = ['телефон', 'усталость', 'суета', 'перфекционизм'];
  return items[index % items.length] ?? 'суета';
}

function buildDailyMarks(days = 30): DailyMark[] {
  const marks: DailyMark[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const dayIndex = days - 1 - i;
    const completedQuest = dayIndex % 6 !== 0;

    marks.push({
      date: isoDay(i),
      completedQuest,
      resistance: completedQuest ? (((dayIndex % 5) + 1) as 1 | 2 | 3 | 4 | 5) : null,
      startedOnTime: completedQuest ? chooseStartedTiming(dayIndex) : null,
      obstacle: completedQuest ? chooseObstacle(dayIndex + 1) : null,
      period: completedQuest ? choosePeriod(dayIndex + 2) : null,
    });
  }

  return marks;
}

function mostCommon(items: string[]): string | null {
  if (!items.length) {
    return null;
  }

  const stats = new Map<string, number>();
  items.forEach((value) => stats.set(value, (stats.get(value) ?? 0) + 1));
  let winner: string | null = null;
  let count = 0;

  stats.forEach((value, key) => {
    if (value > count) {
      winner = key;
      count = value;
    }
  });

  return winner;
}

function mostCommonPeriod(items: DayPeriod[]): DayPeriod | null {
  if (!items.length) {
    return null;
  }

  const stats = new Map<DayPeriod, number>();
  items.forEach((value) => stats.set(value, (stats.get(value) ?? 0) + 1));
  let winner: DayPeriod | null = null;
  let count = 0;

  stats.forEach((value, key) => {
    if (value > count) {
      winner = key;
      count = value;
    }
  });

  return winner;
}

function summarize(windowDays: 3 | 7 | 30, marks: DailyMark[]): CheckpointSummary {
  const recent = marks.slice(-windowDays);
  const completed = recent.filter((item) => item.completedQuest);
  const resistances = completed
    .map((item) => item.resistance)
    .filter((value): value is 1 | 2 | 3 | 4 | 5 => value !== null);

  const averageResistance =
    resistances.length > 0
      ? Number((resistances.reduce((sum, value) => sum + value, 0) / resistances.length).toFixed(1))
      : null;

  const mostCommonObstacle = mostCommon(
    completed.map((item) => item.obstacle).filter((value): value is string => Boolean(value)),
  );

  const bestPeriod = mostCommonPeriod(
    completed.map((item) => item.period).filter((value): value is DayPeriod => Boolean(value)),
  );

  const recommendation =
    averageResistance !== null && averageResistance >= 3.5
      ? 'Сделай старт проще: начни с 5 минут и убери телефон.'
      : 'Продолжай маленькие шаги: стабильность важнее идеальности.';

  return {
    windowDays,
    completedQuests: completed.length,
    totalDays: windowDays,
    averageResistance,
    mostCommonObstacle,
    bestPeriod,
    recommendation,
  };
}

function buildTrend(marks: DailyMark[], history: TraitHistoryPoint[]): TrendPoint[] {
  return marks.slice(-14).map((mark) => {
    const traitPoint = history.find((item) => item.date === mark.date);
    const stability = traitPoint
      ? Math.round((traitPoint.traits.discipline + traitPoint.traits.selfControl + traitPoint.traits.responsibility) / 3)
      : 0;

    const onTimeRate = mark.startedOnTime === 'late' ? 45 : mark.startedOnTime === 'on_time' ? 78 : 90;

    return {
      date: mark.date,
      resistance: mark.resistance ?? 0,
      onTimeRate,
      stability,
    };
  });
}

const traitHistory = buildTraitHistory();
const dailyMarks = buildDailyMarks();
const latestTraits = traitHistory[traitHistory.length - 1]?.traits ?? {
  discipline: 0,
  selfControl: 0,
  emotionalStability: 0,
  awareness: 0,
  responsibility: 0,
  confidence: 0,
};

const progressMockData: ProgressData = {
  hasPracticeData: true,
  currentFocus: 'Дисциплина',
  chapterDay: 12,
  chapterLength: 30,
  chapterProgressPercent: 40,
  daysToNextCheckpoint: 2,
  milestones: [3, 7, 30],
  traits: latestTraits,
  traitHistory,
  dailyMarks,
  summary3d: summarize(3, dailyMarks),
  summary7d: summarize(7, dailyMarks),
  trend: buildTrend(dailyMarks, traitHistory),
  events: [
    { id: 'e1', title: 'День закрыт в спокойном темпе', date: isoDay(0), tone: 'positive' },
    { id: 'e2', title: 'Этап 3 дня пройден', date: isoDay(1), tone: 'positive' },
    { id: 'e3', title: 'Новая техника освоена', date: isoDay(3), tone: 'neutral' },
    { id: 'e4', title: 'Срыв -> перезапуск без вины', date: isoDay(5), tone: 'recovery' },
    { id: 'e5', title: 'День закрыт', date: isoDay(7), tone: 'neutral' },
    { id: 'e6', title: 'Недельный итог сохранен', date: isoDay(9), tone: 'positive' },
  ],
};

const progressEmptyData: ProgressData = {
  hasPracticeData: false,
  currentFocus: 'Дисциплина',
  chapterDay: null,
  chapterLength: 30,
  chapterProgressPercent: 0,
  daysToNextCheckpoint: null,
  milestones: [3, 7, 30],
  traits: {
    discipline: 0,
    selfControl: 0,
    emotionalStability: 0,
    awareness: 0,
    responsibility: 0,
    confidence: 0,
  },
  traitHistory: [],
  dailyMarks: [],
  summary3d: null,
  summary7d: null,
  trend: [],
  events: [],
};

export function getProgressData(): ProgressData {
  return useProgressMockData ? progressMockData : progressEmptyData;
}

