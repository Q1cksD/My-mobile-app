import { TraitHistoryPoint, TraitScores } from '../progress/types';

export interface ArchetypeProfile {
  name: string;
  description: string;
  level: number;
  weeklyGrowth: number;
}

export interface CharacterData {
  hasPracticeData: boolean;
  traits: TraitScores;
  traitHistory: TraitHistoryPoint[];
  archetype: ArchetypeProfile;
  weeklyDelta: number;
  monthlyDelta: number;
  stableDaysWeek: number;
  relapseDaysWeek: number;
}
