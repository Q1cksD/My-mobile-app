import { ProgramData } from '../types/program';

export const USE_PROGRAM_MOCK = true;

export const PROGRAM_MOCK: ProgramData = {
  beacon: {
    title: 'Свобода и уважение к себе',
    subtitle: 'Я строю характер, чтобы держать слово себе каждый день.',
    initials: 'СУ',
  },
  focus: {
    title: 'Держать обещание себе',
    description: 'Сегодня важнее начать вовремя, чем сделать идеально.',
    dayInChapter: 4,
    chapterLength: 30,
  },
  technique: {
    title: 'Правило 5 минут',
    whyItWorks: 'Мозгу легче согласиться на короткий старт, чем на большую задачу.',
    steps: [
      'Открой задачу и назови первый микро-шаг.',
      'Поставь таймер на 5 минут и начни без оценки результата.',
      'После сигнала реши: продолжить или зафиксировать маленькую победу.',
    ],
  },
  dailyQuest: {
    text: '10 минут важного дела без отвлечений.',
    defaultMinutes: 5,
    allowedDurations: [10, 15],
  },
  checkpoint: {
    daysToNextCheckpoint: 3,
    reportCadenceDays: [3, 7, 30],
  },
  questCompletedToday: false,
};

export const PROGRAM_EMPTY: ProgramData = {
  beacon: null,
  focus: null,
  technique: null,
  dailyQuest: null,
  checkpoint: null,
  questCompletedToday: false,
};

export function getProgramData(): ProgramData {
  return USE_PROGRAM_MOCK ? PROGRAM_MOCK : PROGRAM_EMPTY;
}
