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
import { AppState, DailyCheckin, GoalCategory, SettingsBlock, SettingsBlockKind, UserGoal } from './types';
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

function createGoal(category: GoalCategory): UserGoal {
  const template = GOAL_TEMPLATES.find((item) => item.id === category);
  return {
    id: `${category}-${Date.now()}`,
    category,
    customAction: template?.description ?? 'Стать лучше в выбранной сфере',
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

function sectionSubtitle(kind: SettingsBlockKind): string | undefined {
  if (kind === 'emotions') {
    return 'Что вы хотите контролировать в течение недели';
  }
  if (kind === 'habits') {
    return 'Опишите привычку, которую хотите добавить';
  }
  if (kind === 'values') {
    return 'Сформулируйте личные принципы';
  }
  if (kind === 'custom') {
    return 'Свободный блок заметок';
  }
  return undefined;
}

function sectionPlaceholder(kind: SettingsBlockKind): string {
  if (kind === 'emotions') {
    return 'Например: делать паузу и 3 глубоких вдоха перед ответом';
  }
  if (kind === 'habits') {
    return 'Например: 20 минут чтения каждый день';
  }
  if (kind === 'values') {
    return 'Например: быть последовательным и уважительным в общении';
  }
  return 'Введите описание или заметку';
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

    Alert.alert('Сохранено', 'Чек-ин за сегодня сохранён.');
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

  const upsertNote = (key: string, note: string) => {
    setState((prev) => ({
      ...prev,
      sectionNotes: {
        ...prev.sectionNotes,
        [key]: note,
      },
    }));
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
      delete nextNotes[blockId];

      return {
        ...prev,
        settingsBlocks: prev.settingsBlocks.filter((block) => block.id !== blockId),
        sectionNotes: nextNotes,
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

  const openPaywall = () => selectMenuItem('premium');

  const finishOnboarding = () => {
    if (!state.profile.name.trim()) {
      Alert.alert('Нужно имя', 'Добавьте имя, чтобы завершить приветствие.');
      return;
    }

    if (!state.goals.length) {
      Alert.alert('Выберите цель', 'Добавьте хотя бы одну цель на этапе настройки.');
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
        title="Настройка целей"
        subtitle="Выберите направления, в которых хотите становиться лучше"
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
                  placeholder="Например: отвечать спокойно в чатах"
                />
              ) : null}
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="Напоминания" subtitle="Включите push-уведомления и настройте частоту">
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

  const renderSettingsSection = () => {
    if (!selectedSettingsBlock) {
      return null;
    }

    if (selectedSettingsBlock.kind === 'traits') {
      return (
        <>
          <Pressable style={styles.backBtn} onPress={() => setSettingsSection(null)}>
            <Text style={styles.backBtnText}>{'< Назад'}</Text>
          </Pressable>
          {renderTraitsSettings()}
        </>
      );
    }

    return (
      <>
        <Pressable style={styles.backBtn} onPress={() => setSettingsSection(null)}>
          <Text style={styles.backBtnText}>{'< Назад'}</Text>
        </Pressable>
        <SectionCard title={selectedSettingsBlock.title} subtitle={sectionSubtitle(selectedSettingsBlock.kind)}>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder={sectionPlaceholder(selectedSettingsBlock.kind)}
            value={state.sectionNotes[selectedSettingsBlock.id] ?? ''}
            onChangeText={(text) => upsertNote(selectedSettingsBlock.id, text)}
            multiline
          />
        </SectionCard>
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
                  <Text style={styles.settingsMenuBtnText}>⋮</Text>
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
          <Text style={styles.applyReorderBtnText}>✓</Text>
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
          <Text style={styles.appSubtitle}>Сделаем короткую первичную настройку в 3 шага.</Text>

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

      <View style={[styles.topStatsBar, { paddingTop: androidTopInset + 8 }]}>
        <View style={styles.topStatsLeft}>
          <Text style={styles.topStatItem}>Цели: {activeGoals}</Text>
          <Text style={styles.topStatItem}>Чек-ин: {todayCheckin ? `${todayCheckin.score}/5` : '-'}</Text>
          <Text style={styles.topStatItem}>7д: {weeklySuccess}%</Text>
        </View>
        <Pressable style={styles.profileBtn} onPress={() => selectMenuItem('profile')}>
          <Text style={styles.profileBtnText}>Профиль</Text>
        </Pressable>
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#f7faff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    flex: 1,
  },
  topStatItem: {
    color: '#4f6288',
    fontSize: 12,
    fontWeight: '700',
  },
  profileBtn: {
    borderWidth: 1,
    borderColor: '#c6d6fb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    marginLeft: 8,
  },
  profileBtnText: {
    color: '#2f53b6',
    fontWeight: '700',
    fontSize: 12,
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
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d6e1f8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  backBtnText: {
    color: '#3f568f',
    fontWeight: '700',
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
  noteInput: {
    minHeight: 90,
    textAlignVertical: 'top',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#20366f',
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
