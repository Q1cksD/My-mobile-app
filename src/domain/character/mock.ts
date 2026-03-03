import { TraitHistoryPoint, TraitScores } from '../progress/types';
import { ArchetypeProfile, CharacterData } from './types';
import { useMockData } from '../mockConfig';

export const useCharacterMockData = useMockData;

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
    const index = days - 1 - i;
    const base = 38 + index * 0.75;

    const traits: TraitScores = {
      discipline: Math.round(clamp(base + 18 + Math.sin(index / 3) * 5, 0, 100)),
      selfControl: Math.round(clamp(base + 13 + Math.cos(index / 4) * 4, 0, 100)),
      emotionalStability: Math.round(clamp(base + 10 + Math.sin(index / 5) * 5, 0, 100)),
      awareness: Math.round(clamp(base + 9 + Math.cos(index / 6) * 4, 0, 100)),
      responsibility: Math.round(clamp(base + 15 + Math.sin(index / 4) * 4, 0, 100)),
      confidence: Math.round(clamp(base + 8 + Math.cos(index / 7) * 6, 0, 100)),
    };

    history.push({ date: isoDay(i), traits });
  }

  return history;
}

function averageScore(traits: TraitScores): number {
  const values = Object.values(traits);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deriveArchetype(traits: TraitScores, weeklyGrowth: number): ArchetypeProfile {
  if (traits.discipline >= 70 && traits.responsibility >= 65) {
    return {
      name: 'Практик',
      description: 'Ты опираешься на действия и держишь курс даже в загруженные дни.',
      level: 12,
      weeklyGrowth,
    };
  }

  if (traits.emotionalStability >= 68) {
    return {
      name: 'Устойчивый',
      description: 'Ты возвращаешься к курсу спокойно и не теряешь себя при нагрузке.',
      level: 11,
      weeklyGrowth,
    };
  }

  if (traits.selfControl >= 63 && traits.awareness >= 60) {
    return {
      name: 'Собранный',
      description: 'Ты умеешь вовремя замечать импульсы и выбирать взрослую реакцию.',
      level: 10,
      weeklyGrowth,
    };
  }

  if (traits.confidence >= 62) {
    return {
      name: 'Надежный лидер',
      description: 'Ты укрепляешь уверенность через регулярные шаги и внутреннюю опору.',
      level: 10,
      weeklyGrowth,
    };
  }

  return {
    name: 'Исследователь',
    description: 'Ты собираешь базу привычек и постепенно превращаешь их в характер.',
    level: 9,
    weeklyGrowth,
  };
}

const traitHistory = buildTraitHistory();
const firstTraits = traitHistory[0]?.traits;
const lastTraits = traitHistory[traitHistory.length - 1]?.traits;

const weeklyBaseline = traitHistory[traitHistory.length - 8]?.traits ?? firstTraits;
const weeklyDelta = weeklyBaseline && lastTraits ? Math.round(averageScore(lastTraits) - averageScore(weeklyBaseline)) : 0;
const monthlyDelta = firstTraits && lastTraits ? Math.round(averageScore(lastTraits) - averageScore(firstTraits)) : 0;

const characterMockData: CharacterData = {
  hasPracticeData: true,
  traits:
    lastTraits ?? {
      discipline: 0,
      selfControl: 0,
      emotionalStability: 0,
      awareness: 0,
      responsibility: 0,
      confidence: 0,
    },
  traitHistory,
  archetype: deriveArchetype(
    lastTraits ?? {
      discipline: 0,
      selfControl: 0,
      emotionalStability: 0,
      awareness: 0,
      responsibility: 0,
      confidence: 0,
    },
    weeklyDelta,
  ),
  weeklyDelta,
  monthlyDelta,
  stableDaysWeek: 5,
  relapseDaysWeek: 1,
};

const characterEmptyData: CharacterData = {
  hasPracticeData: false,
  traits: {
    discipline: 0,
    selfControl: 0,
    emotionalStability: 0,
    awareness: 0,
    responsibility: 0,
    confidence: 0,
  },
  traitHistory: [],
  archetype: {
    name: 'Формируется',
    description: 'Сделай первые шаги — архетип начнет проявляться.',
    level: 1,
    weeklyGrowth: 0,
  },
  weeklyDelta: 0,
  monthlyDelta: 0,
  stableDaysWeek: 0,
  relapseDaysWeek: 0,
};

export function getCharacterData(): CharacterData {
  return useCharacterMockData ? characterMockData : characterEmptyData;
}

