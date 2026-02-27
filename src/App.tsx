import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar as RNStatusBar,
  Switch,
  Text,
  TextInput,
  Image,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { GoalCard } from './components/GoalCard';
import { SectionCard } from './components/SectionCard';
import { GOAL_TEMPLATES } from './constants/templates';
import { useNotifications } from './hooks/useNotifications';
import { HistoryRange, HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { ProfileMenuScreen } from './screens/ProfileMenuScreen';
import {
  AppState,
  BlockTask,
  DailyCheckin,
  GoalCategory,
  SettingsBlock,
  SettingsBlockKind,
  TaskReminderSettings,
  UserGoal,
  WeekdayKey,
} from './types';
import { lastNDays, todayKey } from './utils/date';
import { defaultState, loadState, saveState } from './utils/storage';

type TabKey = 'home' | 'history' | 'settings' | 'premium' | 'profile';
type SettingsSection = string | null;
type TemplateBlockKind = Extract<SettingsBlockKind, 'traits' | 'emotions' | 'habits' | 'values'>;

const BASE_SETTINGS_BLOCKS: { kind: TemplateBlockKind; title: string; color: string }[] = [
  { kind: 'traits', title: 'Черты характера', color: '#eef4ff' },
  { kind: 'emotions', title: 'Эмоции', color: '#eefaf5' },
  { kind: 'habits', title: 'Привычки', color: '#fff8eb' },
  { kind: 'values', title: 'Ценности и убеждения', color: '#f5f0ff' },
];

const CUSTOM_BLOCK_COLORS = ['#f0f6ff', '#fff6ef', '#effaf2', '#fff0f6', '#f7f3ff'];
const SETTINGS_CARD_HEIGHT = 96;
const SETTINGS_CARD_GAP = 12;
const SETTINGS_CARD_STEP = SETTINGS_CARD_HEIGHT + SETTINGS_CARD_GAP;
const WEEKDAY_OPTIONS: { id: WeekdayKey; label: string }[] = [
  { id: 'mon', label: 'Пн' },
  { id: 'tue', label: 'Вт' },
  { id: 'wed', label: 'Ср' },
  { id: 'thu', label: 'Чт' },
  { id: 'fri', label: 'Пт' },
  { id: 'sat', label: 'Сб' },
  { id: 'sun', label: 'Вс' },
];

const TITLE_SUGGESTIONS: Record<TemplateBlockKind, string[]> = {
  traits: ['Спокойная реакция', 'Дисциплина в мелочах', 'Уверенный тон', 'Фокус без отвлечений'],
  habits: ['Утренняя зарядка', 'Чтение 20 минут', 'План на день', 'Ранний отход ко сну'],
  emotions: ['Пауза перед ответом', 'Контроль раздражения', 'Техники расслабления', 'Управление тревогой'],
  values: ['Быть честным', 'Уважение к близким', 'Последовательность', 'Ответственность и честность'],
};

type TaskWizardStep = 1 | 2 | 3 | 4;

interface TaskDraft {
  title: string;
  description: string;
  motivation: string;
  motivationImageUri: string;
  reminders: TaskReminderSettings;
}

function createGoal(category: GoalCategory): UserGoal {
  const template = GOAL_TEMPLATES.find((item) => item.id === category);
  return {
    id: `${category}-${Date.now()}`,
    category,
    customAction: template?.description ?? 'Новый шаг в развитии себя',
    isActive: true,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (!moved) {
    return items;
  }

  next.splice(to, 0, moved);
  return next;
}

function createTaskDraft(): TaskDraft {
  return {
    title: '',
    description: '',
    motivation: '',
    motivationImageUri: '',
    reminders: {
      enabled: false,
      config: {
        mode: 'fixed',
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        times: [],
      },
    },
  };
}

function cloneTaskReminders(reminders: TaskReminderSettings): TaskReminderSettings {
  if (reminders.config.mode === 'fixed') {
    return {
      enabled: reminders.enabled,
      config: {
        mode: 'fixed',
        weekdays: [...reminders.config.weekdays],
        times: [...reminders.config.times],
      },
    };
  }

  return {
    enabled: reminders.enabled,
    config: {
      mode: 'random',
      weekdays: [...reminders.config.weekdays],
      startHour: reminders.config.startHour,
      endHour: reminders.config.endHour,
      timesInWindow: reminders.config.timesInWindow,
    },
  };
}

function createTaskDraftFromTask(task: BlockTask): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    motivation: task.motivation,
    motivationImageUri: task.motivationImageUri,
    reminders: cloneTaskReminders(task.reminders),
  };
}

function isTaskReminderValid(reminders: TaskReminderSettings): boolean {
  if (!reminders.enabled) {
    return true;
  }
  if (!reminders.config.weekdays.length) {
    return false;
  }
  if (reminders.config.mode === 'fixed') {
    return reminders.config.times.length > 0;
  }
  return reminders.config.endHour > reminders.config.startHour;
}

function normalizeTimeValue(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function weekdayLabel(day: WeekdayKey): string {
  const found = WEEKDAY_OPTIONS.find((item) => item.id === day);
  return found?.label ?? day;
}

function taskReminderSummary(reminders: TaskReminderSettings): string {
  if (!reminders.enabled) {
    return 'Напоминания выключены';
  }

  const days = reminders.config.weekdays.map(weekdayLabel).join(', ');
  if (reminders.config.mode === 'fixed') {
    const times = reminders.config.times.length ? reminders.config.times.join(', ') : 'время не выбрано';
    return `Фиксированно: ${days}, в ${times}`;
  }

  return `Случайно: ${days}, ${hourLabel(reminders.config.startHour)}-${hourLabel(reminders.config.endHour)}, ${reminders.config.timesInWindow} раз(а)`;
}

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('settings');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [historyRange, setHistoryRange] = useState<HistoryRange>(7);
  const [checkinScore, setCheckinScore] = useState<number | null>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [activeMenuBlockId, setActiveMenuBlockId] = useState<string | null>(null);
  const [renameBlockId, setRenameBlockId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isNewBlockModalVisible, setIsNewBlockModalVisible] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [taskWizardStep, setTaskWizardStep] = useState<TaskWizardStep>(1);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(createTaskDraft);
  const [taskBlockId, setTaskBlockId] = useState<string | null>(null);
  const [fixedTimeInput, setFixedTimeInput] = useState('');
  const [isTaskEditModalVisible, setIsTaskEditModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState<TaskDraft>(createTaskDraft);
  const [editFixedTimeInput, setEditFixedTimeInput] = useState('');
  const [isImageUriModalVisible, setIsImageUriModalVisible] = useState(false);
  const [imageUriInput, setImageUriInput] = useState('');
  const [isEditImageUriModalVisible, setIsEditImageUriModalVisible] = useState(false);
  const [editImageUriInput, setEditImageUriInput] = useState('');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<SettingsBlock[]>([]);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState(0);
  const dragY = useRef(new Animated.Value(0)).current;
  const draggingBlockRef = useRef<string | null>(null);
  const dragBaseBlocksRef = useRef<SettingsBlock[]>([]);
  const dragOriginIndexRef = useRef(0);
  const dragTargetIndexRef = useRef(0);
  const { setupNotifications } = useNotifications();

  const androidTopInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;

  useEffect(() => {
    async function bootstrap() {
      const stored = await loadState();
      setState(stored);
      setLoaded(true);
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    void saveState(state);
  }, [loaded, state]);

  const today = todayKey();
  const todayCheckin = state.checkins.find((item) => item.date === today);
  const activeGoalsList = useMemo(() => state.goals.filter((goal) => goal.isActive), [state.goals]);
  const activeGoals = activeGoalsList.length;
  const visibleSettingsBlocks = isReorderMode ? draftBlocks : state.settingsBlocks;
  const selectedSettingsBlock = useMemo(
    () => state.settingsBlocks.find((block) => block.id === settingsSection) ?? null,
    [settingsSection, state.settingsBlocks],
  );
  const activeMenuBlock = useMemo(
    () => state.settingsBlocks.find((block) => block.id === activeMenuBlockId) ?? null,
    [activeMenuBlockId, state.settingsBlocks],
  );
  const missingTemplateBlocks = useMemo(
    () =>
      BASE_SETTINGS_BLOCKS.filter(
        (template) => !state.settingsBlocks.some((block) => block.kind === template.kind),
      ),
    [state.settingsBlocks],
  );
  const draggingBlock = useMemo(
    () => visibleSettingsBlocks.find((block) => block.id === draggingBlockId) ?? null,
    [draggingBlockId, visibleSettingsBlocks],
  );
  const selectedBlockTasks = useMemo(
    () => (selectedSettingsBlock ? state.sectionTasks[selectedSettingsBlock.id] ?? [] : []),
    [selectedSettingsBlock, state.sectionTasks],
  );
  const selectedBlockTitleSuggestions = useMemo(() => {
    if (!selectedSettingsBlock || selectedSettingsBlock.kind === 'custom') {
      return [];
    }

    return TITLE_SUGGESTIONS[selectedSettingsBlock.kind as TemplateBlockKind] ?? [];
  }, [selectedSettingsBlock]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    void setupNotifications(state.reminderSettings, activeGoalsList);
  }, [activeGoalsList, loaded, setupNotifications, state.reminderSettings]);

  useEffect(() => {
    setCheckinScore(todayCheckin?.score ?? null);
    setCheckinNote(todayCheckin?.note ?? '');
  }, [todayCheckin]);

  useEffect(() => {
    draggingBlockRef.current = draggingBlockId;
  }, [draggingBlockId]);

  useEffect(() => {
    if (settingsSection && !state.settingsBlocks.some((block) => block.id === settingsSection)) {
      setSettingsSection(null);
    }
  }, [settingsSection, state.settingsBlocks]);

  const weeklySuccess = useMemo(() => {
    const week = new Set(lastNDays(7));
    const weekCheckins = state.checkins.filter((item) => week.has(item.date));
    const successful = weekCheckins.filter((item) => item.score >= 4).length;
    return Math.round((successful / 7) * 100);
  }, [state.checkins]);

  const historyData = useMemo(() => {
    const dates = new Set(lastNDays(historyRange));
    const records = state.checkins
      .filter((item) => dates.has(item.date))
      .sort((a, b) => b.date.localeCompare(a.date));
    const average =
      records.length > 0 ? (records.reduce((sum, item) => sum + item.score, 0) / records.length).toFixed(1) : '0.0';
    const strongDays = records.filter((item) => item.score >= 4).length;
    const completion = Math.round((records.length / historyRange) * 100);

    return { records, average, strongDays, completion };
  }, [historyRange, state.checkins]);

  const finishDrag = useCallback(() => {
    if (!draggingBlockRef.current) {
      return;
    }

    const finalBlocks = moveItem(
      dragBaseBlocksRef.current,
      dragOriginIndexRef.current,
      dragTargetIndexRef.current,
    );
    dragBaseBlocksRef.current = finalBlocks;
    setDraftBlocks(finalBlocks);
    setDraggingBlockId(null);
    draggingBlockRef.current = null;
    dragY.setValue(0);
  }, [dragY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(draggingBlockRef.current),
        onMoveShouldSetPanResponder: () => Boolean(draggingBlockRef.current),
        onPanResponderMove: (_, gestureState) => {
          if (!draggingBlockRef.current || dragBaseBlocksRef.current.length <= 1) {
            return;
          }

          dragY.setValue(gestureState.dy);
          const nextIndex = clamp(
            dragOriginIndexRef.current + Math.round(gestureState.dy / SETTINGS_CARD_STEP),
            0,
            dragBaseBlocksRef.current.length - 1,
          );

          if (nextIndex === dragTargetIndexRef.current) {
            return;
          }

          dragTargetIndexRef.current = nextIndex;
          setDraftBlocks(moveItem(dragBaseBlocksRef.current, dragOriginIndexRef.current, nextIndex));
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
      }),
    [dragY, finishDrag],
  );

  const toggleGoal = (category: GoalCategory) => {
    setState((prev) => {
      const existing = prev.goals.find((goal) => goal.category === category);
      return {
        ...prev,
        goals: existing
          ? prev.goals.filter((goal) => goal.category !== category)
          : [...prev.goals, createGoal(category)],
      };
    });
  };

  const updateGoalAction = (category: GoalCategory, text: string) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) => (goal.category === category ? { ...goal, customAction: text } : goal)),
    }));
  };

  const updateReminderWindow = (field: 'startHour' | 'endHour', delta: number) => {
    setState((prev) => {
      let startHour = prev.reminderSettings.startHour;
      let endHour = prev.reminderSettings.endHour;

      if (field === 'startHour') {
        startHour = clamp(startHour + delta, 0, 22);
        if (startHour >= endHour) {
          endHour = clamp(startHour + 1, 1, 23);
        }
      } else {
        endHour = clamp(endHour + delta, 1, 23);
        if (endHour <= startHour) {
          startHour = clamp(endHour - 1, 0, 22);
        }
      }

      return {
        ...prev,
        reminderSettings: {
          ...prev.reminderSettings,
          startHour,
          endHour,
        },
      };
    });
  };

  const saveTodayCheckin = () => {
    if (checkinScore === null) {
      Alert.alert('Выберите оценку', 'Нужно выбрать оценку дня от 1 до 5.');
      return;
    }

    setState((prev) => {
      const checkin: DailyCheckin = {
        date: today,
        score: checkinScore,
        note: checkinNote.trim(),
      };
      const existing = prev.checkins.some((item) => item.date === today);

      return {
        ...prev,
        checkins: existing
          ? prev.checkins.map((item) => (item.date === today ? checkin : item))
          : [...prev.checkins, checkin],
      };
    });

    Alert.alert('Сохранено', 'Чекин за сегодня сохранен.');
  };

  const selectMenuItem = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'settings') {
      setSettingsSection(null);
      return;
    }

    setIsReorderMode(false);
    setDraftBlocks([]);
    setDraggingBlockId(null);
    draggingBlockRef.current = null;
    dragY.setValue(0);
  };

  const openBlock = (blockId: string) => {
    if (isReorderMode) {
      return;
    }
    setSettingsSection(blockId);
  };

  const startReorderForBlock = (blockId: string) => {
    const source = isReorderMode ? draftBlocks : state.settingsBlocks;
    const startIndex = source.findIndex((block) => block.id === blockId);
    if (startIndex === -1) {
      return;
    }

    if (!isReorderMode) {
      setIsReorderMode(true);
      setDraftBlocks(source);
    }

    dragBaseBlocksRef.current = source;
    dragOriginIndexRef.current = startIndex;
    dragTargetIndexRef.current = startIndex;
    setDragOriginIndex(startIndex);
    setDraggingBlockId(blockId);
    draggingBlockRef.current = blockId;
    dragY.setValue(0);
  };

  const startDragFromPress = (blockId: string) => {
    if (!isReorderMode || draggingBlockId === blockId) {
      return;
    }

    startReorderForBlock(blockId);
  };

  const applyReorder = () => {
    if (!isReorderMode) {
      return;
    }

    if (draggingBlockRef.current) {
      finishDrag();
    }

    setState((prev) => ({
      ...prev,
      settingsBlocks: draftBlocks.length ? draftBlocks : prev.settingsBlocks,
    }));
    setIsReorderMode(false);
    setDraftBlocks([]);
    setDraggingBlockId(null);
    draggingBlockRef.current = null;
    dragY.setValue(0);
  };

  const openRename = () => {
    if (!activeMenuBlock) {
      return;
    }
    setRenameBlockId(activeMenuBlock.id);
    setRenameValue(activeMenuBlock.title);
    setActiveMenuBlockId(null);
  };

  const applyRename = () => {
    if (!renameBlockId) {
      return;
    }

    const title = renameValue.trim();
    if (!title) {
      Alert.alert('Нужен заголовок', 'Введите название блока.');
      return;
    }

    setState((prev) => ({
      ...prev,
      settingsBlocks: prev.settingsBlocks.map((block) =>
        block.id === renameBlockId ? { ...block, title } : block,
      ),
    }));
    setRenameBlockId(null);
    setRenameValue('');
  };

  const deleteBlock = (blockId: string) => {
    setState((prev) => {
      const nextNotes = { ...prev.sectionNotes };
      const nextTasks = { ...prev.sectionTasks };
      delete nextNotes[blockId];
      delete nextTasks[blockId];

      return {
        ...prev,
        settingsBlocks: prev.settingsBlocks.filter((block) => block.id !== blockId),
        sectionNotes: nextNotes,
        sectionTasks: nextTasks,
      };
    });

    setActiveMenuBlockId(null);
    if (settingsSection === blockId) {
      setSettingsSection(null);
    }
  };

  const addTemplateBlock = (kind: TemplateBlockKind) => {
    const template = BASE_SETTINGS_BLOCKS.find((item) => item.kind === kind);
    if (!template) {
      return;
    }

    setState((prev) => ({
      ...prev,
      settingsBlocks: [
        ...prev.settingsBlocks,
        {
          id: template.kind,
          kind: template.kind,
          title: template.title,
          color: template.color,
        },
      ],
      sectionNotes: {
        ...prev.sectionNotes,
        [template.kind]: prev.sectionNotes[template.kind] ?? '',
      },
    }));
    setIsAddModalVisible(false);
  };

  const addCustomBlock = () => {
    const title = newBlockName.trim();
    if (!title) {
      Alert.alert('Нужен заголовок', 'Введите название нового блока.');
      return;
    }

    setState((prev) => {
      const customCount = prev.settingsBlocks.filter((block) => block.kind === 'custom').length;
      const color = CUSTOM_BLOCK_COLORS[customCount % CUSTOM_BLOCK_COLORS.length] ?? '#f0f6ff';
      const id = `custom-${Date.now()}`;

      return {
        ...prev,
        settingsBlocks: [...prev.settingsBlocks, { id, kind: 'custom', title, color }],
        sectionNotes: {
          ...prev.sectionNotes,
          [id]: '',
        },
      };
    });

    setNewBlockName('');
    setIsNewBlockModalVisible(false);
  };

  const openTaskWizard = () => {
    if (!selectedSettingsBlock) {
      return;
    }

    setTaskBlockId(selectedSettingsBlock.id);
    setTaskDraft(createTaskDraft());
    setTaskWizardStep(1);
    setFixedTimeInput('');
    setIsTaskModalVisible(true);
  };

  const closeTaskWizard = () => {
    setIsTaskModalVisible(false);
    setTaskBlockId(null);
    setTaskWizardStep(1);
    setTaskDraft(createTaskDraft());
    setFixedTimeInput('');
  };

  const openTaskEditor = (task: BlockTask) => {
    setEditingTaskId(task.id);
    setEditTaskDraft(createTaskDraftFromTask(task));
    setEditFixedTimeInput('');
    setIsTaskEditModalVisible(true);
  };

  const closeTaskEditor = () => {
    setIsTaskEditModalVisible(false);
    setEditingTaskId(null);
    setEditTaskDraft(createTaskDraft());
    setEditFixedTimeInput('');
    setIsEditImageUriModalVisible(false);
    setEditImageUriInput('');
  };

  const toggleReminderWeekday = (day: WeekdayKey) => {
    setTaskDraft((prev) => {
      const list = prev.reminders.config.weekdays;
      const exists = list.includes(day);
      const nextWeekdays = exists ? list.filter((item) => item !== day) : [...list, day];

      return {
        ...prev,
        reminders: {
          ...prev.reminders,
          config: {
            ...prev.reminders.config,
            weekdays: nextWeekdays,
          },
        },
      };
    });
  };

  const switchReminderMode = (mode: 'fixed' | 'random') => {
    setTaskDraft((prev) => ({
      ...prev,
      reminders: {
        ...prev.reminders,
        config:
          mode === 'fixed'
            ? {
                mode: 'fixed',
                weekdays: prev.reminders.config.weekdays,
                times: prev.reminders.config.mode === 'fixed' ? prev.reminders.config.times : [],
              }
            : {
                mode: 'random',
                weekdays: prev.reminders.config.weekdays,
                startHour: prev.reminders.config.mode === 'random' ? prev.reminders.config.startHour : 9,
                endHour: prev.reminders.config.mode === 'random' ? prev.reminders.config.endHour : 21,
                timesInWindow: prev.reminders.config.mode === 'random' ? prev.reminders.config.timesInWindow : 3,
              },
      },
    }));
  };

  const addFixedTime = () => {
    const normalized = normalizeTimeValue(fixedTimeInput);
    if (!normalized) {
      Alert.alert('Некорректное время', 'Введите время в формате ЧЧ:ММ, например 09:30.');
      return;
    }

    setTaskDraft((prev) => {
      if (prev.reminders.config.mode !== 'fixed') {
        return prev;
      }

      if (prev.reminders.config.times.includes(normalized)) {
        return prev;
      }

      return {
        ...prev,
        reminders: {
          ...prev.reminders,
          config: {
            ...prev.reminders.config,
            times: [...prev.reminders.config.times, normalized].sort(),
          },
        },
      };
    });
    setFixedTimeInput('');
  };

  const removeFixedTime = (time: string) => {
    setTaskDraft((prev) => {
      if (prev.reminders.config.mode !== 'fixed') {
        return prev;
      }

      return {
        ...prev,
        reminders: {
          ...prev.reminders,
          config: {
            ...prev.reminders.config,
            times: prev.reminders.config.times.filter((item) => item !== time),
          },
        },
      };
    });
  };

  const toggleEditReminderWeekday = (day: WeekdayKey) => {
    setEditTaskDraft((prev) => {
      const list = prev.reminders.config.weekdays;
      const exists = list.includes(day);
      const nextWeekdays = exists ? list.filter((item) => item !== day) : [...list, day];

      return {
        ...prev,
        reminders: {
          ...prev.reminders,
          config: {
            ...prev.reminders.config,
            weekdays: nextWeekdays,
          },
        },
      };
    });
  };

  const switchEditReminderMode = (mode: 'fixed' | 'random') => {
    setEditTaskDraft((prev) => ({
      ...prev,
      reminders: {
        ...prev.reminders,
        config:
          mode === 'fixed'
            ? {
                mode: 'fixed',
                weekdays: prev.reminders.config.weekdays,
                times: prev.reminders.config.mode === 'fixed' ? prev.reminders.config.times : [],
              }
            : {
                mode: 'random',
                weekdays: prev.reminders.config.weekdays,
                startHour: prev.reminders.config.mode === 'random' ? prev.reminders.config.startHour : 9,
                endHour: prev.reminders.config.mode === 'random' ? prev.reminders.config.endHour : 21,
                timesInWindow: prev.reminders.config.mode === 'random' ? prev.reminders.config.timesInWindow : 3,
              },
      },
    }));
  };

  const addEditFixedTime = () => {
    const normalized = normalizeTimeValue(editFixedTimeInput);
    if (!normalized) {
      Alert.alert('Некорректное время', 'Введите время в формате ЧЧ:ММ, например 09:30.');
      return;
    }

    setEditTaskDraft((prev) => {
      if (prev.reminders.config.mode !== 'fixed') {
        return prev;
      }

      if (prev.reminders.config.times.includes(normalized)) {
        return prev;
      }

      return {
        ...prev,
        reminders: {
          ...prev.reminders,
          config: {
            ...prev.reminders.config,
            times: [...prev.reminders.config.times, normalized].sort(),
          },
        },
      };
    });
    setEditFixedTimeInput('');
  };

  const removeEditFixedTime = (time: string) => {
    setEditTaskDraft((prev) => {
      if (prev.reminders.config.mode !== 'fixed') {
        return prev;
      }

      return {
        ...prev,
        reminders: {
          ...prev.reminders,
          config: {
            ...prev.reminders.config,
            times: prev.reminders.config.times.filter((item) => item !== time),
          },
        },
      };
    });
  };

  const canProceedTaskStep = useMemo(() => {
    if (taskWizardStep === 1) {
      return taskDraft.title.trim().length > 0;
    }
    if (taskWizardStep === 2) {
      return taskDraft.description.trim().length > 0;
    }
    if (taskWizardStep === 3) {
      return taskDraft.motivation.trim().length > 0;
    }

    return isTaskReminderValid(taskDraft.reminders);
  }, [taskDraft, taskWizardStep]);

  const nextTaskWizardStep = () => {
    if (!canProceedTaskStep) {
      Alert.alert('Заполните шаг', 'Добавьте данные на текущем этапе, чтобы продолжить.');
      return;
    }

    if (taskWizardStep === 4) {
      if (!taskBlockId) {
        return;
      }

      const newTask: BlockTask = {
        id: `task-${Date.now()}`,
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim(),
        motivation: taskDraft.motivation.trim(),
        motivationImageUri: taskDraft.motivationImageUri.trim(),
        reminders: cloneTaskReminders(taskDraft.reminders),
      };

      setState((prev) => ({
        ...prev,
        sectionTasks: {
          ...prev.sectionTasks,
          [taskBlockId]: [...(prev.sectionTasks[taskBlockId] ?? []), newTask],
        },
      }));
      closeTaskWizard();
      return;
    }

    setTaskWizardStep((prev) => (prev === 4 ? 4 : ((prev + 1) as TaskWizardStep)));
  };

  const prevTaskWizardStep = () => {
    setTaskWizardStep((prev) => (prev === 1 ? 1 : ((prev - 1) as TaskWizardStep)));
  };

  const saveTaskEdit = () => {
    if (!selectedSettingsBlock || !editingTaskId) {
      return;
    }

    const title = editTaskDraft.title.trim();
    if (!title) {
      Alert.alert('Нужен заголовок', 'Введите название задачи.');
      return;
    }

    const description = editTaskDraft.description.trim();
    if (!description) {
      Alert.alert('Нужно описание', 'Опишите, что именно нужно делать.');
      return;
    }

    const motivation = editTaskDraft.motivation.trim();
    if (!motivation) {
      Alert.alert('Нужна мотивация', 'Добавьте вашу мотивацию для задачи.');
      return;
    }

    if (!isTaskReminderValid(editTaskDraft.reminders)) {
      Alert.alert('Проверьте напоминания', 'Выберите дни недели и корректное время для напоминаний.');
      return;
    }

    const nextTask: BlockTask = {
      id: editingTaskId,
      title,
      description,
      motivation,
      motivationImageUri: editTaskDraft.motivationImageUri.trim(),
      reminders: cloneTaskReminders(editTaskDraft.reminders),
    };

    setState((prev) => ({
      ...prev,
      sectionTasks: {
        ...prev.sectionTasks,
        [selectedSettingsBlock.id]: (prev.sectionTasks[selectedSettingsBlock.id] ?? []).map((task) =>
          task.id === editingTaskId ? nextTask : task,
        ),
      },
    }));

    closeTaskEditor();
  };

  const openPaywall = () => selectMenuItem('premium');

  const finishOnboarding = () => {
    if (!state.profile.name.trim()) {
      Alert.alert('Нужно имя', 'Добавьте имя, чтобы завершить приветствие.');
      return;
    }

    if (!state.goals.length) {
      Alert.alert('Выберите цель', 'Выберите хотя бы одну цель, чтобы пройти дальше.');
      return;
    }

    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        onboardingCompleted: true,
      },
    }));
    setActiveTab('settings');
  };

  const renderTraitsSettings = () => (
    <>
      <SectionCard
        title="Выберите цели"
        subtitle="Отметьте направления, в которых хотите развивать себя"
      >
        {GOAL_TEMPLATES.map((template) => {
          const selected = state.goals.find((goal) => goal.category === template.id);
          return (
            <View key={template.id}>
              <GoalCard template={template} selected={selected} onToggle={toggleGoal} />
              {selected ? (
                <TextInput
                  style={styles.input}
                  value={selected.customAction}
                  onChangeText={(text) => updateGoalAction(template.id, text)}
                  placeholder="Например: говорить спокойнее в сложных ситуациях"
                />
              ) : null}
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="Напоминания" subtitle="Настройте push-уведомления в удобном режиме">
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Включить напоминания</Text>
          <Switch
            value={state.reminderSettings.enabled}
            onValueChange={(enabled) =>
              setState((prev) => ({
                ...prev,
                reminderSettings: { ...prev.reminderSettings, enabled },
              }))
            }
          />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Раз в день</Text>
          <View style={styles.counterRow}>
            <Pressable
              style={styles.counterBtn}
              onPress={() =>
                setState((prev) => ({
                  ...prev,
                  reminderSettings: {
                    ...prev.reminderSettings,
                    timesPerDay: Math.max(1, prev.reminderSettings.timesPerDay - 1),
                  },
                }))
              }
            >
              <Text style={styles.counterBtnText}>-</Text>
            </Pressable>
            <Text style={styles.counterValue}>{state.reminderSettings.timesPerDay}</Text>
            <Pressable
              style={styles.counterBtn}
              onPress={() =>
                setState((prev) => ({
                  ...prev,
                  reminderSettings: {
                    ...prev.reminderSettings,
                    timesPerDay: Math.min(8, prev.reminderSettings.timesPerDay + 1),
                  },
                }))
              }
            >
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Начало окна</Text>
          <View style={styles.counterRow}>
            <Pressable style={styles.counterBtn} onPress={() => updateReminderWindow('startHour', -1)}>
              <Text style={styles.counterBtnText}>-</Text>
            </Pressable>
            <Text style={styles.counterValue}>{hourLabel(state.reminderSettings.startHour)}</Text>
            <Pressable style={styles.counterBtn} onPress={() => updateReminderWindow('startHour', 1)}>
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Конец окна</Text>
          <View style={styles.counterRow}>
            <Pressable style={styles.counterBtn} onPress={() => updateReminderWindow('endHour', -1)}>
              <Text style={styles.counterBtnText}>-</Text>
            </Pressable>
            <Text style={styles.counterValue}>{hourLabel(state.reminderSettings.endHour)}</Text>
            <Pressable style={styles.counterBtn} onPress={() => updateReminderWindow('endHour', 1)}>
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.helper}>
          Активных целей: {activeGoals}. Напоминания отправляются в интервале{' '}
          {hourLabel(state.reminderSettings.startHour)}-{hourLabel(state.reminderSettings.endHour)}.
        </Text>
      </SectionCard>
    </>
  );

  const renderTaskCards = () => {
    if (selectedBlockTasks.length === 0) {
      return <Text style={styles.helper}>Пока нет задач. Нажмите кнопку выше, чтобы добавить первую.</Text>;
    }

    return (
      <View style={styles.taskList}>
        {selectedBlockTasks.map((task) => (
          <Pressable key={task.id} style={styles.taskCard} onPress={() => openTaskEditor(task)}>
            <Text style={styles.taskCardTitle}>{task.title}</Text>
            <Text style={styles.taskCardText}>{task.description}</Text>
            <Text style={styles.taskCardLabel}>Мотивация</Text>
            <Text style={styles.taskCardText}>{task.motivation}</Text>
            {task.motivationImageUri ? <Image source={{ uri: task.motivationImageUri }} style={styles.taskImage} /> : null}
            <Text style={styles.taskReminderText}>{taskReminderSummary(task.reminders)}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderSettingsSection = () => {
    if (!selectedSettingsBlock) {
      return null;
    }

    return (
      <>
        <Text style={styles.sectionHeaderTitle}>{selectedSettingsBlock.title}</Text>

        <Pressable style={styles.blockTopAddBtn} onPress={openTaskWizard}>
          <Text style={styles.blockTopAddBtnText}>+ Добавить задачу</Text>
        </Pressable>

        {renderTaskCards()}
      </>
    );
  };

  const renderSettingsHome = () => (
    <View style={styles.settingsGridWrap}>
      {isReorderMode ? <Text style={styles.reorderHint}>Перетащите блоки и нажмите ✓, чтобы применить</Text> : null}
      <View style={styles.settingsGrid} {...panResponder.panHandlers}>
        {visibleSettingsBlocks.map((block) => {
          const isDragging = draggingBlockId === block.id;
          return (
            <Pressable
              key={block.id}
              style={[
                styles.settingsCardBtn,
                { backgroundColor: block.color },
                isReorderMode ? styles.settingsCardReorder : null,
                isDragging ? styles.settingsCardGhost : null,
              ]}
              onPress={() => openBlock(block.id)}
              onLongPress={() => {
                if (!isReorderMode) {
                  startReorderForBlock(block.id);
                }
              }}
              onPressIn={() => startDragFromPress(block.id)}
              onPressOut={() => {
                if (draggingBlockId === block.id) {
                  finishDrag();
                }
              }}
              delayLongPress={180}
              disabled={Boolean(draggingBlockId) && !isDragging}
            >
              <Text style={styles.settingsCardText}>{block.title}</Text>
              {!isReorderMode ? (
                <Pressable
                  style={styles.settingsMenuBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    setActiveMenuBlockId(block.id);
                  }}
                >
                  <Text style={styles.settingsMenuBtnText}>{'\u22EE'}</Text>
                </Pressable>
              ) : (
                <Text style={styles.dragHint}>Перетаскивание</Text>
              )}
            </Pressable>
          );
        })}

        {!isReorderMode ? (
          <Pressable style={[styles.settingsCardBtn, styles.addBlockCard]} onPress={() => setIsAddModalVisible(true)}>
            <Text style={styles.addBlockPlus}>+</Text>
          </Pressable>
        ) : null}

        {isReorderMode && draggingBlock ? (
          <Animated.View
            style={[
              styles.dragOverlay,
              {
                top: dragOriginIndex * SETTINGS_CARD_STEP,
                transform: [{ translateY: dragY }],
              },
            ]}
          >
            <View style={[styles.settingsCardBtn, styles.dragOverlayCard, { backgroundColor: draggingBlock.color }]}>
              <Text style={styles.settingsCardText}>{draggingBlock.title}</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>

      {isReorderMode ? (
        <Pressable style={styles.applyReorderBtn} onPress={applyReorder}>
          <Text style={styles.applyReorderBtnText}>{'\u2713'}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка Character+...</Text>
      </SafeAreaView>
    );
  }

  if (!state.profile.onboardingCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.appTitle}>Добро пожаловать в Character+</Text>
          <Text style={styles.appSubtitle}>Пройдите короткую первичную настройку в 3 шага.</Text>

          <SectionCard title={`Шаг ${onboardingStep} из 3`}>
            {onboardingStep === 1 ? (
              <>
                <Text style={styles.label}>Как к вам обращаться?</Text>
                <TextInput
                  style={styles.input}
                  value={state.profile.name}
                  onChangeText={(name) =>
                    setState((prev) => ({
                      ...prev,
                      profile: { ...prev.profile, name },
                    }))
                  }
                  placeholder="Введите имя"
                />
              </>
            ) : null}

            {onboardingStep === 2 ? renderTraitsSettings() : null}

            {onboardingStep === 3 ? (
              <>
                <Text style={styles.helper}>Почти готово, {state.profile.name || 'друг'}.</Text>
                <Text style={styles.helper}>Выбрано целей: {activeGoals}</Text>
                <Text style={styles.helper}>
                  Напоминания: {state.reminderSettings.enabled ? 'включены' : 'выключены'},{' '}
                  {state.reminderSettings.timesPerDay} раз(а) в день
                </Text>
                <Text style={styles.helper}>
                  Окно: {hourLabel(state.reminderSettings.startHour)}-{hourLabel(state.reminderSettings.endHour)}
                </Text>
              </>
            ) : null}
          </SectionCard>

          <View style={styles.onboardingActions}>
            <Pressable
              style={[styles.secondaryBtn, onboardingStep === 1 ? styles.disabledBtn : null]}
              disabled={onboardingStep === 1}
              onPress={() => setOnboardingStep((prev) => Math.max(1, prev - 1))}
            >
              <Text style={styles.secondaryBtnText}>Назад</Text>
            </Pressable>
            {onboardingStep < 3 ? (
              <Pressable style={styles.primaryBtn} onPress={() => setOnboardingStep((prev) => Math.min(3, prev + 1))}>
                <Text style={styles.primaryBtnText}>Далее</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={finishOnboarding}>
                <Text style={styles.primaryBtnText}>Завершить</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />

      <View style={[styles.topStatsBar, { paddingTop: androidTopInset + 10 }]}>
        <View style={styles.topBarSideLeft}>
          {activeTab === 'settings' && settingsSection ? (
            <Pressable style={styles.topBackBtn} onPress={() => setSettingsSection(null)}>
              <Text style={styles.topBackBtnText}>{'< Назад'}</Text>
            </Pressable>
          ) : (
            <View style={styles.topBackStub} />
          )}
        </View>
        <View style={styles.topBarCenter}>
          <View style={styles.topStatsRow}>
            <Text style={styles.topStatItem}>Цели: {activeGoals}</Text>
            <Text style={styles.topStatItem}>Чек-ин: {todayCheckin ? `${todayCheckin.score}/5` : '-'}</Text>
            <Text style={styles.topStatItem}>7д: {weeklySuccess}%</Text>
          </View>
        </View>
        <View style={styles.topBarSideRight}>
          <Pressable style={styles.profileBtn} onPress={() => selectMenuItem('profile')}>
            <Text style={styles.profileBtnText}>Профиль</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.topDivider} />

      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!(activeTab === 'settings' && isReorderMode)}>
        {activeTab === 'home' ? (
          <HomeScreen
            userName={state.profile.name}
            activeGoals={activeGoals}
            weeklySuccess={weeklySuccess}
            todayCheckin={todayCheckin}
            checkinScore={checkinScore}
            checkinNote={checkinNote}
            onScoreChange={setCheckinScore}
            onNoteChange={setCheckinNote}
            onSaveCheckin={saveTodayCheckin}
          />
        ) : null}

        {activeTab === 'history' ? (
          <HistoryScreen
            historyRange={historyRange}
            historyData={historyData}
            isPremium={state.profile.isPremium}
            onRangeSelect={setHistoryRange}
            onOpenPremium={openPaywall}
          />
        ) : null}

        {activeTab === 'settings' ? (settingsSection ? renderSettingsSection() : renderSettingsHome()) : null}

        {activeTab === 'premium' ? (
          <PremiumScreen
            isPremium={state.profile.isPremium}
            onTogglePremium={() =>
              setState((prev) => ({
                ...prev,
                profile: { ...prev.profile, isPremium: !prev.profile.isPremium },
              }))
            }
            onContinueFree={() => selectMenuItem('settings')}
          />
        ) : null}

        {activeTab === 'profile' ? (
          <ProfileMenuScreen
            name={state.profile.name}
            isPremium={state.profile.isPremium}
            onNavigate={selectMenuItem}
          />
        ) : null}
      </ScrollView>

      <Modal visible={isTaskModalVisible} transparent animationType="fade" onRequestClose={closeTaskWizard}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={closeTaskWizard} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{`Шаг ${taskWizardStep} из 4`}</Text>
            <Text style={styles.modalStepTitle}>
              {taskWizardStep === 1
                ? 'Название задачи'
                : taskWizardStep === 2
                  ? 'Описание задачи'
                  : taskWizardStep === 3
                    ? 'Мотивация'
                    : 'Напоминания'}
            </Text>

            {taskWizardStep === 1 ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={taskDraft.title}
                  onChangeText={(title) => setTaskDraft((prev) => ({ ...prev, title }))}
                  placeholder="Введите название задачи"
                />
                {selectedBlockTitleSuggestions.length > 0 ? (
                  <View style={styles.suggestionsWrap}>
                    {selectedBlockTitleSuggestions.map((item) => (
                      <Pressable
                        key={item}
                        style={styles.suggestionChip}
                        onPress={() => setTaskDraft((prev) => ({ ...prev, title: item }))}
                      >
                        <Text style={styles.suggestionChipText}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {taskWizardStep === 2 ? (
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                value={taskDraft.description}
                onChangeText={(description) => setTaskDraft((prev) => ({ ...prev, description }))}
                placeholder="Опишите, что именно и как вы хотите делать по этой задаче"
                multiline
              />
            ) : null}

            {taskWizardStep === 3 ? (
              <>
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea]}
                  value={taskDraft.motivation}
                  onChangeText={(motivation) => setTaskDraft((prev) => ({ ...prev, motivation }))}
                  placeholder="Укажите вашу мотивацию - ради чего или кого вы меняетесь"
                  multiline
                />

                <Pressable
                  style={styles.modalActionBtn}
                  onPress={() => {
                    setImageUriInput(taskDraft.motivationImageUri);
                    setIsImageUriModalVisible(true);
                  }}
                >
                  <Text style={styles.modalActionText}>Загрузить</Text>
                </Pressable>
                <Text style={styles.modalHint}>Сюда можно загрузить фотографию, которая вас будет мотивировать.</Text>

                {taskDraft.motivationImageUri ? (
                  <Image source={{ uri: taskDraft.motivationImageUri }} style={styles.taskImagePreview} />
                ) : null}
              </>
            ) : null}

            {taskWizardStep === 4 ? (
              <>
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Включить напоминания</Text>
                  <Switch
                    value={taskDraft.reminders.enabled}
                    onValueChange={(enabled) =>
                      setTaskDraft((prev) => ({
                        ...prev,
                        reminders: {
                          ...prev.reminders,
                          enabled,
                        },
                      }))
                    }
                  />
                </View>

                {taskDraft.reminders.enabled ? (
                  <>
                    <View style={styles.modeRow}>
                      <Pressable
                        style={[
                          styles.modeChip,
                          taskDraft.reminders.config.mode === 'fixed' ? styles.modeChipActive : null,
                        ]}
                        onPress={() => switchReminderMode('fixed')}
                      >
                        <Text
                          style={[
                            styles.modeChipText,
                            taskDraft.reminders.config.mode === 'fixed' ? styles.modeChipTextActive : null,
                          ]}
                        >
                          Фиксированное время
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.modeChip,
                          taskDraft.reminders.config.mode === 'random' ? styles.modeChipActive : null,
                        ]}
                        onPress={() => switchReminderMode('random')}
                      >
                        <Text
                          style={[
                            styles.modeChipText,
                            taskDraft.reminders.config.mode === 'random' ? styles.modeChipTextActive : null,
                          ]}
                        >
                          Случайно в промежутке
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={styles.modalSectionLabel}>Дни недели</Text>
                    <View style={styles.weekdayRow}>
                      {WEEKDAY_OPTIONS.map((day) => {
                        const selected = taskDraft.reminders.config.weekdays.includes(day.id);
                        return (
                          <Pressable
                            key={day.id}
                            style={[styles.weekdayChip, selected ? styles.weekdayChipActive : null]}
                            onPress={() => toggleReminderWeekday(day.id)}
                          >
                            <Text style={[styles.weekdayChipText, selected ? styles.weekdayChipTextActive : null]}>
                              {day.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {taskDraft.reminders.config.mode === 'fixed' ? (
                      <>
                        <Text style={styles.modalSectionLabel}>Точное время (можно добавить несколько)</Text>
                        <View style={styles.timeInputRow}>
                          <TextInput
                            style={[styles.modalInput, styles.timeInput]}
                            value={fixedTimeInput}
                            onChangeText={setFixedTimeInput}
                            placeholder="Например 09:30"
                          />
                          <Pressable style={styles.timeAddBtn} onPress={addFixedTime}>
                            <Text style={styles.timeAddBtnText}>Добавить</Text>
                          </Pressable>
                        </View>
                        <View style={styles.suggestionsWrap}>
                          {taskDraft.reminders.config.times.map((time) => (
                            <Pressable key={time} style={styles.suggestionChip} onPress={() => removeFixedTime(time)}>
                              <Text style={styles.suggestionChipText}>{time} ×</Text>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.modalSectionLabel}>Временное окно</Text>
                        <View style={styles.rowBetween}>
                          <Text style={styles.label}>С</Text>
                          <View style={styles.counterRow}>
                            <Pressable
                              style={styles.counterBtn}
                              onPress={() =>
                                setTaskDraft((prev) => {
                                  if (prev.reminders.config.mode !== 'random') {
                                    return prev;
                                  }
                                  const startHour = clamp(prev.reminders.config.startHour - 1, 0, 22);
                                  const endHour = Math.max(prev.reminders.config.endHour, startHour + 1);
                                  return {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      config: { ...prev.reminders.config, startHour, endHour },
                                    },
                                  };
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>-</Text>
                            </Pressable>
                            <Text style={styles.counterValue}>
                              {taskDraft.reminders.config.mode === 'random'
                                ? `${String(taskDraft.reminders.config.startHour).padStart(2, '0')}:00`
                                : '--:--'}
                            </Text>
                            <Pressable
                              style={styles.counterBtn}
                              onPress={() =>
                                setTaskDraft((prev) => {
                                  if (prev.reminders.config.mode !== 'random') {
                                    return prev;
                                  }
                                  const startHour = clamp(prev.reminders.config.startHour + 1, 0, 22);
                                  const endHour = Math.max(prev.reminders.config.endHour, startHour + 1);
                                  return {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      config: { ...prev.reminders.config, startHour, endHour },
                                    },
                                  };
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>+</Text>
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.rowBetween}>
                          <Text style={styles.label}>До</Text>
                          <View style={styles.counterRow}>
                            <Pressable
                              style={styles.counterBtn}
                              onPress={() =>
                                setTaskDraft((prev) => {
                                  if (prev.reminders.config.mode !== 'random') {
                                    return prev;
                                  }
                                  const endHour = clamp(prev.reminders.config.endHour - 1, 1, 23);
                                  const startHour = Math.min(prev.reminders.config.startHour, endHour - 1);
                                  return {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      config: { ...prev.reminders.config, startHour, endHour },
                                    },
                                  };
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>-</Text>
                            </Pressable>
                            <Text style={styles.counterValue}>
                              {taskDraft.reminders.config.mode === 'random'
                                ? `${String(taskDraft.reminders.config.endHour).padStart(2, '0')}:00`
                                : '--:--'}
                            </Text>
                            <Pressable
                              style={styles.counterBtn}
                              onPress={() =>
                                setTaskDraft((prev) => {
                                  if (prev.reminders.config.mode !== 'random') {
                                    return prev;
                                  }
                                  const endHour = clamp(prev.reminders.config.endHour + 1, 1, 23);
                                  const startHour = Math.min(prev.reminders.config.startHour, endHour - 1);
                                  return {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      config: { ...prev.reminders.config, startHour, endHour },
                                    },
                                  };
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>+</Text>
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.rowBetween}>
                          <Text style={styles.label}>Раз в окне</Text>
                          <View style={styles.counterRow}>
                            <Pressable
                              style={styles.counterBtn}
                              onPress={() =>
                                setTaskDraft((prev) => {
                                  if (prev.reminders.config.mode !== 'random') {
                                    return prev;
                                  }
                                  return {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      config: {
                                        ...prev.reminders.config,
                                        timesInWindow: Math.max(1, prev.reminders.config.timesInWindow - 1),
                                      },
                                    },
                                  };
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>-</Text>
                            </Pressable>
                            <Text style={styles.counterValue}>
                              {taskDraft.reminders.config.mode === 'random'
                                ? taskDraft.reminders.config.timesInWindow
                                : 0}
                            </Text>
                            <Pressable
                              style={styles.counterBtn}
                              onPress={() =>
                                setTaskDraft((prev) => {
                                  if (prev.reminders.config.mode !== 'random') {
                                    return prev;
                                  }
                                  return {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      config: {
                                        ...prev.reminders.config,
                                        timesInWindow: Math.min(12, prev.reminders.config.timesInWindow + 1),
                                      },
                                    },
                                  };
                                })
                              }
                            >
                              <Text style={styles.counterBtnText}>+</Text>
                            </Pressable>
                          </View>
                        </View>
                      </>
                    )}
                  </>
                ) : null}
              </>
            ) : null}

            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelBtnSmall}
                onPress={taskWizardStep === 1 ? closeTaskWizard : prevTaskWizardStep}
              >
                <Text style={styles.modalCancelText}>{taskWizardStep === 1 ? 'Отмена' : 'Назад'}</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={nextTaskWizardStep}>
                <Text style={styles.modalConfirmText}>{taskWizardStep === 4 ? 'Создать задачу' : 'Далее'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isTaskEditModalVisible} transparent animationType="fade" onRequestClose={closeTaskEditor}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={closeTaskEditor} />
          <View style={[styles.modalCard, styles.taskEditModalCard]}>
            <Text style={styles.modalTitle}>Редактирование задачи</Text>

            <ScrollView style={styles.taskEditScroll} contentContainerStyle={styles.taskEditContent}>
              <Text style={styles.modalSectionLabel}>Название</Text>
              <TextInput
                style={styles.modalInput}
                value={editTaskDraft.title}
                onChangeText={(title) => setEditTaskDraft((prev) => ({ ...prev, title }))}
                placeholder="Введите название задачи"
              />

              {selectedBlockTitleSuggestions.length > 0 ? (
                <View style={styles.suggestionsWrap}>
                  {selectedBlockTitleSuggestions.map((item) => (
                    <Pressable
                      key={`edit-${item}`}
                      style={styles.suggestionChip}
                      onPress={() => setEditTaskDraft((prev) => ({ ...prev, title: item }))}
                    >
                      <Text style={styles.suggestionChipText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={styles.modalSectionLabel}>Описание</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                value={editTaskDraft.description}
                onChangeText={(description) => setEditTaskDraft((prev) => ({ ...prev, description }))}
                placeholder="Опишите, что именно и как вы хотите делать по этой задаче"
                multiline
              />

              <Text style={styles.modalSectionLabel}>Мотивация</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                value={editTaskDraft.motivation}
                onChangeText={(motivation) => setEditTaskDraft((prev) => ({ ...prev, motivation }))}
                placeholder="Укажите вашу мотивацию - ради чего или кого вы меняетесь"
                multiline
              />
              <Pressable
                style={styles.modalActionBtn}
                onPress={() => {
                  setEditImageUriInput(editTaskDraft.motivationImageUri);
                  setIsEditImageUriModalVisible(true);
                }}
              >
                <Text style={styles.modalActionText}>Загрузить</Text>
              </Pressable>
              <Text style={styles.modalHint}>Сюда можно загрузить фотографию, которая вас будет мотивировать.</Text>
              {editTaskDraft.motivationImageUri ? (
                <Image source={{ uri: editTaskDraft.motivationImageUri }} style={styles.taskImagePreview} />
              ) : null}

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Включить напоминания</Text>
                <Switch
                  value={editTaskDraft.reminders.enabled}
                  onValueChange={(enabled) =>
                    setEditTaskDraft((prev) => ({
                      ...prev,
                      reminders: {
                        ...prev.reminders,
                        enabled,
                      },
                    }))
                  }
                />
              </View>

              {editTaskDraft.reminders.enabled ? (
                <>
                  <View style={styles.modeRow}>
                    <Pressable
                      style={[
                        styles.modeChip,
                        editTaskDraft.reminders.config.mode === 'fixed' ? styles.modeChipActive : null,
                      ]}
                      onPress={() => switchEditReminderMode('fixed')}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          editTaskDraft.reminders.config.mode === 'fixed' ? styles.modeChipTextActive : null,
                        ]}
                      >
                        Фиксированное время
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modeChip,
                        editTaskDraft.reminders.config.mode === 'random' ? styles.modeChipActive : null,
                      ]}
                      onPress={() => switchEditReminderMode('random')}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          editTaskDraft.reminders.config.mode === 'random' ? styles.modeChipTextActive : null,
                        ]}
                      >
                        Случайно в промежутке
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.modalSectionLabel}>Дни недели</Text>
                  <View style={styles.weekdayRow}>
                    {WEEKDAY_OPTIONS.map((day) => {
                      const selected = editTaskDraft.reminders.config.weekdays.includes(day.id);
                      return (
                        <Pressable
                          key={`edit-day-${day.id}`}
                          style={[styles.weekdayChip, selected ? styles.weekdayChipActive : null]}
                          onPress={() => toggleEditReminderWeekday(day.id)}
                        >
                          <Text style={[styles.weekdayChipText, selected ? styles.weekdayChipTextActive : null]}>
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {editTaskDraft.reminders.config.mode === 'fixed' ? (
                    <>
                      <Text style={styles.modalSectionLabel}>Точное время (можно добавить несколько)</Text>
                      <View style={styles.timeInputRow}>
                        <TextInput
                          style={[styles.modalInput, styles.timeInput]}
                          value={editFixedTimeInput}
                          onChangeText={setEditFixedTimeInput}
                          placeholder="Например 09:30"
                        />
                        <Pressable style={styles.timeAddBtn} onPress={addEditFixedTime}>
                          <Text style={styles.timeAddBtnText}>Добавить</Text>
                        </Pressable>
                      </View>
                      <View style={styles.suggestionsWrap}>
                        {editTaskDraft.reminders.config.times.map((time) => (
                          <Pressable
                            key={`edit-time-${time}`}
                            style={styles.suggestionChip}
                            onPress={() => removeEditFixedTime(time)}
                          >
                            <Text style={styles.suggestionChipText}>{time} ×</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.modalSectionLabel}>Временное окно</Text>
                      <View style={styles.rowBetween}>
                        <Text style={styles.label}>С</Text>
                        <View style={styles.counterRow}>
                          <Pressable
                            style={styles.counterBtn}
                            onPress={() =>
                              setEditTaskDraft((prev) => {
                                if (prev.reminders.config.mode !== 'random') {
                                  return prev;
                                }
                                const startHour = clamp(prev.reminders.config.startHour - 1, 0, 22);
                                const endHour = Math.max(prev.reminders.config.endHour, startHour + 1);
                                return {
                                  ...prev,
                                  reminders: {
                                    ...prev.reminders,
                                    config: { ...prev.reminders.config, startHour, endHour },
                                  },
                                };
                              })
                            }
                          >
                            <Text style={styles.counterBtnText}>-</Text>
                          </Pressable>
                          <Text style={styles.counterValue}>
                            {editTaskDraft.reminders.config.mode === 'random'
                              ? `${String(editTaskDraft.reminders.config.startHour).padStart(2, '0')}:00`
                              : '--:--'}
                          </Text>
                          <Pressable
                            style={styles.counterBtn}
                            onPress={() =>
                              setEditTaskDraft((prev) => {
                                if (prev.reminders.config.mode !== 'random') {
                                  return prev;
                                }
                                const startHour = clamp(prev.reminders.config.startHour + 1, 0, 22);
                                const endHour = Math.max(prev.reminders.config.endHour, startHour + 1);
                                return {
                                  ...prev,
                                  reminders: {
                                    ...prev.reminders,
                                    config: { ...prev.reminders.config, startHour, endHour },
                                  },
                                };
                              })
                            }
                          >
                            <Text style={styles.counterBtnText}>+</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.rowBetween}>
                        <Text style={styles.label}>До</Text>
                        <View style={styles.counterRow}>
                          <Pressable
                            style={styles.counterBtn}
                            onPress={() =>
                              setEditTaskDraft((prev) => {
                                if (prev.reminders.config.mode !== 'random') {
                                  return prev;
                                }
                                const endHour = clamp(prev.reminders.config.endHour - 1, 1, 23);
                                const startHour = Math.min(prev.reminders.config.startHour, endHour - 1);
                                return {
                                  ...prev,
                                  reminders: {
                                    ...prev.reminders,
                                    config: { ...prev.reminders.config, startHour, endHour },
                                  },
                                };
                              })
                            }
                          >
                            <Text style={styles.counterBtnText}>-</Text>
                          </Pressable>
                          <Text style={styles.counterValue}>
                            {editTaskDraft.reminders.config.mode === 'random'
                              ? `${String(editTaskDraft.reminders.config.endHour).padStart(2, '0')}:00`
                              : '--:--'}
                          </Text>
                          <Pressable
                            style={styles.counterBtn}
                            onPress={() =>
                              setEditTaskDraft((prev) => {
                                if (prev.reminders.config.mode !== 'random') {
                                  return prev;
                                }
                                const endHour = clamp(prev.reminders.config.endHour + 1, 1, 23);
                                const startHour = Math.min(prev.reminders.config.startHour, endHour - 1);
                                return {
                                  ...prev,
                                  reminders: {
                                    ...prev.reminders,
                                    config: { ...prev.reminders.config, startHour, endHour },
                                  },
                                };
                              })
                            }
                          >
                            <Text style={styles.counterBtnText}>+</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.rowBetween}>
                        <Text style={styles.label}>Раз в окне</Text>
                        <View style={styles.counterRow}>
                          <Pressable
                            style={styles.counterBtn}
                            onPress={() =>
                              setEditTaskDraft((prev) => {
                                if (prev.reminders.config.mode !== 'random') {
                                  return prev;
                                }
                                return {
                                  ...prev,
                                  reminders: {
                                    ...prev.reminders,
                                    config: {
                                      ...prev.reminders.config,
                                      timesInWindow: Math.max(1, prev.reminders.config.timesInWindow - 1),
                                    },
                                  },
                                };
                              })
                            }
                          >
                            <Text style={styles.counterBtnText}>-</Text>
                          </Pressable>
                          <Text style={styles.counterValue}>
                            {editTaskDraft.reminders.config.mode === 'random'
                              ? editTaskDraft.reminders.config.timesInWindow
                              : 0}
                          </Text>
                          <Pressable
                            style={styles.counterBtn}
                            onPress={() =>
                              setEditTaskDraft((prev) => {
                                if (prev.reminders.config.mode !== 'random') {
                                  return prev;
                                }
                                return {
                                  ...prev,
                                  reminders: {
                                    ...prev.reminders,
                                    config: {
                                      ...prev.reminders.config,
                                      timesInWindow: Math.min(12, prev.reminders.config.timesInWindow + 1),
                                    },
                                  },
                                };
                              })
                            }
                          >
                            <Text style={styles.counterBtnText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </>
                  )}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <Pressable style={styles.modalCancelBtnSmall} onPress={closeTaskEditor}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={saveTaskEdit}>
                <Text style={styles.modalConfirmText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isImageUriModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImageUriModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={() => setIsImageUriModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Изображение мотивации</Text>
            <TextInput
              style={styles.modalInput}
              value={imageUriInput}
              onChangeText={setImageUriInput}
              placeholder="Вставьте ссылку или локальный путь к фото"
            />
            <Text style={styles.modalHint}>После сохранения фото будет отображаться в задаче.</Text>
            <View style={styles.modalActionsRow}>
              <Pressable style={styles.modalCancelBtnSmall} onPress={() => setIsImageUriModalVisible(false)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setTaskDraft((prev) => ({ ...prev, motivationImageUri: imageUriInput.trim() }));
                  setIsImageUriModalVisible(false);
                }}
              >
                <Text style={styles.modalConfirmText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isEditImageUriModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditImageUriModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={() => setIsEditImageUriModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Изображение мотивации</Text>
            <TextInput
              style={styles.modalInput}
              value={editImageUriInput}
              onChangeText={setEditImageUriInput}
              placeholder="Вставьте ссылку или локальный путь к фото"
            />
            <Text style={styles.modalHint}>После сохранения фото будет отображаться в задаче.</Text>
            <View style={styles.modalActionsRow}>
              <Pressable style={styles.modalCancelBtnSmall} onPress={() => setIsEditImageUriModalVisible(false)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setEditTaskDraft((prev) => ({ ...prev, motivationImageUri: editImageUriInput.trim() }));
                  setIsEditImageUriModalVisible(false);
                }}
              >
                <Text style={styles.modalConfirmText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(activeMenuBlock)} transparent animationType="fade" onRequestClose={() => setActiveMenuBlockId(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={() => setActiveMenuBlockId(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeMenuBlock?.title ?? 'Блок'}</Text>
            <Pressable style={styles.modalActionBtn} onPress={openRename}>
              <Text style={styles.modalActionText}>Переименовать</Text>
            </Pressable>
            <Pressable
              style={styles.modalActionBtn}
              onPress={() => {
                if (activeMenuBlock) {
                  deleteBlock(activeMenuBlock.id);
                }
              }}
            >
              <Text style={[styles.modalActionText, styles.modalDangerText]}>Удалить блок</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setActiveMenuBlockId(null)}>
              <Text style={styles.modalCancelText}>Закрыть</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(renameBlockId)} transparent animationType="fade" onRequestClose={() => setRenameBlockId(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={() => setRenameBlockId(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Название блока</Text>
            <TextInput style={styles.modalInput} value={renameValue} onChangeText={setRenameValue} placeholder="Введите название" />
            <View style={styles.modalActionsRow}>
              <Pressable style={styles.modalCancelBtnSmall} onPress={() => setRenameBlockId(null)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={applyRename}>
                <Text style={styles.modalConfirmText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAddModalVisible} transparent animationType="fade" onRequestClose={() => setIsAddModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={() => setIsAddModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Добавление блока</Text>
            <Pressable
              style={styles.modalActionBtn}
              onPress={() => {
                setIsAddModalVisible(false);
                setNewBlockName('');
                setIsNewBlockModalVisible(true);
              }}
            >
              <Text style={styles.modalActionText}>Добавить новый блок</Text>
            </Pressable>

            {missingTemplateBlocks.map((template) => (
              <Pressable
                key={template.kind}
                style={styles.modalActionBtn}
                onPress={() => addTemplateBlock(template.kind)}
              >
                <Text style={styles.modalActionText}>Добавить шаблон: {template.title}</Text>
              </Pressable>
            ))}

            <Pressable style={styles.modalCancelBtn} onPress={() => setIsAddModalVisible(false)}>
              <Text style={styles.modalCancelText}>Закрыть</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isNewBlockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNewBlockModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissLayer} onPress={() => setIsNewBlockModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Новый блок</Text>
            <TextInput
              style={styles.modalInput}
              value={newBlockName}
              onChangeText={setNewBlockName}
              placeholder="Введите название"
            />
            <View style={styles.modalActionsRow}>
              <Pressable style={styles.modalCancelBtnSmall} onPress={() => setIsNewBlockModalVisible(false)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={addCustomBlock}>
                <Text style={styles.modalConfirmText}>Добавить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  topStatsBar: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: '#f7faff',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 82,
  },
  topBarSideLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSideRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  topBackBtn: {
    borderWidth: 1,
    borderColor: '#c6d6fb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  topBackBtnText: {
    color: '#2f53b6',
    fontWeight: '700',
    fontSize: 13,
  },
  topBackStub: {
    width: 86,
    height: 40,
  },
  topStatItem: {
    color: '#4f6288',
    fontSize: 13,
    fontWeight: '700',
  },
  profileBtn: {
    borderWidth: 1,
    borderColor: '#c6d6fb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  profileBtnText: {
    color: '#2f53b6',
    fontWeight: '700',
    fontSize: 13,
  },
  topDivider: {
    height: 1,
    backgroundColor: '#d8e4ff',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  settingsGridWrap: {
    gap: 8,
  },
  settingsGrid: {
    position: 'relative',
  },
  reorderHint: {
    color: '#4b5f8f',
    marginBottom: 8,
  },
  settingsCardBtn: {
    borderRadius: 16,
    minHeight: SETTINGS_CARD_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d6e1f8',
    marginBottom: SETTINGS_CARD_GAP,
    position: 'relative',
  },
  settingsCardText: {
    color: '#2a3a5f',
    fontSize: 18,
    fontWeight: '700',
    paddingRight: 44,
  },
  settingsCardReorder: {
    borderStyle: 'dashed',
  },
  settingsCardGhost: {
    opacity: 0.1,
  },
  settingsMenuBtn: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsMenuBtnText: {
    fontSize: 18,
    color: '#334e94',
    fontWeight: '700',
  },
  dragHint: {
    marginTop: 8,
    color: '#556a98',
    fontSize: 12,
    fontWeight: '600',
  },
  addBlockCard: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderColor: '#9fb5eb',
    backgroundColor: '#f9fcff',
  },
  addBlockPlus: {
    fontSize: 34,
    color: '#3b5fb7',
    fontWeight: '600',
  },
  dragOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  dragOverlayCard: {
    marginBottom: 0,
    shadowColor: '#1a2d5d',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 6,
  },
  applyReorderBtn: {
    alignSelf: 'center',
    minWidth: 76,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2f5ee5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyReorderBtnText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderTitle: {
    color: '#1f325f',
    fontWeight: '800',
    fontSize:32,
    width: '100%',
    textAlign: 'center',
    marginBottom: 16,
    paddingTop: 30,
    paddingBottom: 30,
  },
  blockTopAddBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c4d5fb',
    backgroundColor: '#fff',
    marginTop: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  blockTopAddBtnText: {
    color: '#2e56b6',
    fontWeight: '700',
  },
  taskCard: {
    borderWidth: 1,
    borderColor: '#d7e3ff',
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    padding: 12,
    gap: 6,
  },
  taskList: {
    gap: 10,
    marginTop: 4,
  },
  taskCardTitle: {
    color: '#1d356f',
    fontSize: 17,
    fontWeight: '800',
  },
  taskCardLabel: {
    color: '#3d5487',
    fontWeight: '700',
    marginTop: 4,
  },
  taskCardText: {
    color: '#384c77',
    lineHeight: 19,
  },
  taskReminderText: {
    color: '#34579f',
    fontWeight: '600',
    marginTop: 4,
  },
  taskImage: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    backgroundColor: '#dfe8ff',
    marginTop: 4,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1c2a52',
  },
  appSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: '#516285',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3ff',
  },
  loadingText: {
    color: '#1c2a52',
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: '#2f3e63',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dbe5ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1d2b50',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9d8ff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  counterBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3553a1',
  },
  counterValue: {
    minWidth: 50,
    textAlign: 'center',
    color: '#1d2b50',
    fontWeight: '700',
  },
  helper: {
    color: '#5b6e99',
    lineHeight: 20,
    marginTop: 4,
  },
  onboardingActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b8c8ec',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    color: '#3f568f',
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#4169e1',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 31, 62, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe6ff',
    padding: 14,
    gap: 8,
  },
  taskEditModalCard: {
    maxHeight: '88%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#20366f',
    marginBottom: 2,
  },
  modalStepTitle: {
    color: '#4f669b',
    fontWeight: '600',
    marginBottom: 2,
  },
  modalActionBtn: {
    borderWidth: 1,
    borderColor: '#d8e4ff',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#f8fbff',
  },
  modalActionText: {
    color: '#33539f',
    fontWeight: '600',
  },
  modalDangerText: {
    color: '#b43232',
  },
  modalCancelBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf2ff',
    marginTop: 2,
  },
  modalCancelBtnSmall: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#eef3ff',
  },
  modalCancelText: {
    color: '#4260a8',
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#dbe5ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1d2b50',
    backgroundColor: '#fff',
  },
  modalTextarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  modalHint: {
    color: '#5f6f96',
    fontSize: 12,
    lineHeight: 18,
  },
  taskEditScroll: {
    maxHeight: 520,
  },
  taskEditContent: {
    gap: 8,
    paddingBottom: 4,
  },
  taskImagePreview: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    backgroundColor: '#dfe8ff',
    marginTop: 6,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: '#cad7fb',
    backgroundColor: '#f4f8ff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  suggestionChipText: {
    color: '#3b5694',
    fontWeight: '600',
    fontSize: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cad7fb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeChipActive: {
    backgroundColor: '#2f5ee5',
    borderColor: '#2f5ee5',
  },
  modeChipText: {
    color: '#3e5b9c',
    fontWeight: '600',
    fontSize: 12,
  },
  modeChipTextActive: {
    color: '#fff',
  },
  modalSectionLabel: {
    color: '#304578',
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayChip: {
    width: 42,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#cad7fb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  weekdayChipActive: {
    backgroundColor: '#2f5ee5',
    borderColor: '#2f5ee5',
  },
  weekdayChipText: {
    color: '#3e5b9c',
    fontWeight: '700',
  },
  weekdayChipTextActive: {
    color: '#fff',
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
  },
  timeAddBtn: {
    borderRadius: 10,
    backgroundColor: '#2f5ee5',
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAddBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#2f5ee5',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
