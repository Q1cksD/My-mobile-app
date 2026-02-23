import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GoalCard } from './components/GoalCard';
import { SectionCard } from './components/SectionCard';
import { GOAL_TEMPLATES } from './constants/templates';
import { useNotifications } from './hooks/useNotifications';
import { HistoryRange, HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { AppState, DailyCheckin, GoalCategory, UserGoal } from './types';
import { lastNDays, todayKey } from './utils/date';
import { defaultState, loadState, saveState } from './utils/storage';

type TabKey = 'home' | 'history' | 'settings' | 'premium' | 'profile';

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

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [historyRange, setHistoryRange] = useState<HistoryRange>(7);
  const [checkinScore, setCheckinScore] = useState<number | null>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const { setupNotifications } = useNotifications();

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
    const avg =
      records.length > 0 ? (records.reduce((sum, item) => sum + item.score, 0) / records.length).toFixed(1) : '0.0';
    const strongDays = records.filter((item) => item.score >= 4).length;
    const completion = Math.round((records.length / historyRange) * 100);

    return {
      records,
      average: avg,
      strongDays,
      completion,
    };
  }, [historyRange, state.checkins]);

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
    setActiveTab('home');
  };

  const openPaywall = () => setActiveTab('premium');

  const renderSettingsContent = () => (
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

      <SectionCard title="Напоминания" subtitle="Настройте частоту и окно времени уведомлений">
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
        <StatusBar style="dark" />
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

            {onboardingStep === 2 ? renderSettingsContent() : null}

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
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
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

        {activeTab === 'settings' ? (
          <>
            <Text style={styles.appTitle}>Настройки</Text>
            <Text style={styles.appSubtitle}>Цели, напоминания и окно времени</Text>
            {renderSettingsContent()}
          </>
        ) : null}

        {activeTab === 'premium' ? (
          <PremiumScreen
            isPremium={state.profile.isPremium}
            onTogglePremium={() =>
              setState((prev) => ({
                ...prev,
                profile: { ...prev.profile, isPremium: !prev.profile.isPremium },
              }))
            }
            onContinueFree={() => setActiveTab('home')}
          />
        ) : null}

        {activeTab === 'profile' ? (
          <>
            <Text style={styles.appTitle}>Профиль</Text>
            <Text style={styles.appSubtitle}>Базовые данные и статус подписки</Text>
            <SectionCard title="Пользователь">
              <Text style={styles.metric}>Имя: {state.profile.name || 'не указано'}</Text>
              <Text style={styles.metric}>Статус: {state.profile.isPremium ? 'Premium' : 'Free'}</Text>
            </SectionCard>
            <SectionCard title="Подписка">
              <Text style={styles.helper}>Оплата пока не подключена. Экран Premium готов как каркас.</Text>
              <Pressable style={styles.primaryBtn} onPress={openPaywall}>
                <Text style={styles.primaryBtnText}>Открыть Premium экран</Text>
              </Pressable>
            </SectionCard>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.tabBar}>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('home')}>
          <Text style={[styles.tabText, activeTab === 'home' ? styles.tabTextActive : null]}>Дом</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('history')}>
          <Text style={[styles.tabText, activeTab === 'history' ? styles.tabTextActive : null]}>История</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabText, activeTab === 'settings' ? styles.tabTextActive : null]}>Настр.</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('premium')}>
          <Text style={[styles.tabText, activeTab === 'premium' ? styles.tabTextActive : null]}>Premium</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.tabText, activeTab === 'profile' ? styles.tabTextActive : null]}>Профиль</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
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
  metric: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d2b50',
    marginBottom: 6,
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
  disabledBtn: {
    opacity: 0.5,
  },
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d7e2ff',
    paddingVertical: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabText: {
    color: '#7890c7',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#355ad4',
  },
});
