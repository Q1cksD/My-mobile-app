import { DailyLogEntry, Traits } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function todayIso(): string {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

export function dayDiffInclusive(fromIso: string, toIso: string): number {
  const start = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((end.getTime() - start.getTime()) / msPerDay);
  return diff + 1;
}

function normalizeTraits(next: Traits): Traits {
  return {
    discipline: clamp(Number(next.discipline.toFixed(1)), 0, 100),
    selfControl: clamp(Number(next.selfControl.toFixed(1)), 0, 100),
    emotionalStability: clamp(Number(next.emotionalStability.toFixed(1)), 0, 100),
    awareness: clamp(Number(next.awareness.toFixed(1)), 0, 100),
    responsibility: clamp(Number(next.responsibility.toFixed(1)), 0, 100),
    confidence: clamp(Number(next.confidence.toFixed(1)), 0, 100),
  };
}

function disciplineReward(resistance: DailyLogEntry['resistance']): number {
  if (resistance === 5) {
    return 1.5;
  }
  if (resistance === 4) {
    return 1.3;
  }
  if (resistance === 3) {
    return 1.1;
  }
  if (resistance === 2) {
    return 0.9;
  }
  return 0.8;
}

export function updateTraits(current: Traits, entry: DailyLogEntry, activeDirection: string): Traits {
  if (!entry.questCompleted) {
    return current;
  }

  const next: Traits = { ...current };

  next.discipline += disciplineReward(entry.resistance);
  next.responsibility += 0.4;
  next.awareness += 0.25;
  next.emotionalStability += 0.2;
  next.confidence += 0.2;

  if (entry.startedOnTime === 'on_time') {
    next.selfControl += 0.5;
  } else if (entry.startedOnTime === 'late') {
    next.selfControl += 0.1;
  }

  if (activeDirection === 'discipline') {
    next.discipline += 0.2;
  }

  return normalizeTraits(next);
}
