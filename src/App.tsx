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
import { AppState, GoalCategory, UserGoal } from './types';
import { todayKey, last7Days } from './utils/date';
import { defaultState, loadState, saveState } from './utils/storage';

type TabKey = 'home' | 'settings' | 'profile';

function createGoal(category: GoalCategory): UserGoal {
  const template = GOAL_TEMPLATES.find((item) => item.id === category);
  return {
    id: `${category}-${Date.now()}`,
    category,
    customAction: template?.description ?? 'Стать лучше в выбранной сфере',
    isActive: true,
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [noteInput, setNoteInput] = useState('');
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
    void setupNotifications(state.reminderSettings, state.goals.filter((goal) => goal.isActive));
  }, [loaded, setupNotifications, state]);

  const today = todayKey();
  const todayCheckin = state.checkins.find((item) => item.date === today);

  const weeklySuccess = useMemo(() => {
@@ -87,189 +91,309 @@ export default function App() {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) => (goal.category === category ? { ...goal, customAction: text } : goal)),
    }));
  };

  const saveTodayCheckin = (score: number) => {
    if (score < 1 || score > 5) {
      return;
    }

    setState((prev) => {
      const existing = prev.checkins.find((item) => item.date === today);
      const checkin = { date: today, score, note: noteInput.trim() };
      return {
        ...prev,
        checkins: existing
          ? prev.checkins.map((item) => (item.date === today ? checkin : item))
          : [...prev.checkins, checkin],
      };
    });

    Alert.alert('Сохранено', 'Чек-ин за сегодня сохранён. Отличная работа!');
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

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка Character+...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.appTitle}>Character+</Text>
        <Text style={styles.appSubtitle}>Тренажёр характера через микро-шаги и напоминания</Text>

        <SectionCard
          title="1) Цели на характер"
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

        <SectionCard
          title="2) Напоминания"
          subtitle="Включите push-уведомления и настройте частоту"
        >
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Включить напоминания</Text>
            <Switch
              value={state.reminderSettings.enabled}
              onValueChange={(enabled) =>
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
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>
            <Text style={styles.counterValue}>{state.reminderSettings.timesPerDay}</Text>
            <Pressable
              style={styles.counterBtn}
              onPress={() =>
                setState((prev) => ({
                  ...prev,
                  reminderSettings: { ...prev.reminderSettings, enabled },
                  reminderSettings: {
                    ...prev.reminderSettings,
                    timesPerDay: Math.min(8, prev.reminderSettings.timesPerDay + 1),
                  },
                }))
              }
            />
            >
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.helper}>
          Активных целей: {activeGoals}. Напоминания отправляются в интервале {state.reminderSettings.startHour}:00–
          {state.reminderSettings.endHour}:00.
        </Text>
      </SectionCard>
    </>
  );

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
                <Text style={styles.counterBtnText}>−</Text>
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
          <Text style={styles.helper}>
            Активных целей: {activeGoals}. Напоминания отправляются в интервале {state.reminderSettings.startHour}:00–
            {state.reminderSettings.endHour}:00.
          </Text>
        </SectionCard>

        <SectionCard title="3) Вечерний чек-ин" subtitle="Оцените день и зафиксируйте один вывод">
          <Text style={styles.label}>Как прошёл день по выбранным целям?</Text>
          <View style={styles.scoreRow}>
            {[1, 2, 3, 4, 5].map((score) => (
              <Pressable
                key={score}
                style={[styles.scoreBtn, todayCheckin?.score === score ? styles.scoreBtnActive : null]}
                onPress={() => saveTodayCheckin(score)}
              >
                <Text style={[styles.scoreText, todayCheckin?.score === score ? styles.scoreTextActive : null]}>
                  {score}
  if (!state.profile.onboardingCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.appTitle}>Добро пожаловать в Character+</Text>
          <Text style={styles.appSubtitle}>Сделаем короткую первичную настройку в 3 шага.</Text>

          <SectionCard title={`Шаг ${onboardingStep} из 3`} subtitle="">
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
                <Text style={styles.helper}>Почти готово, {state.profile.name || 'друг'}!</Text>
                <Text style={styles.helper}>• Выбрано целей: {activeGoals}</Text>
                <Text style={styles.helper}>
                  • Напоминания: {state.reminderSettings.enabled ? 'включены' : 'выключены'}, {state.reminderSettings.timesPerDay}{' '}
                  раз(а) в день
                </Text>
                <Text style={styles.helper}>Нажмите "Завершить", чтобы перейти на Главную.</Text>
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
            ))}
            ) : (
              <Pressable style={styles.primaryBtn} onPress={finishOnboarding}>
                <Text style={styles.primaryBtnText}>Завершить</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="Короткая заметка: что сработало или помешало"
            value={noteInput}
            onChangeText={setNoteInput}
            multiline
          />
        </SectionCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'home' ? (
          <>
            <Text style={styles.appTitle}>Главная</Text>
            <Text style={styles.appSubtitle}>С возвращением, {state.profile.name || 'друг'} 👋</Text>
            <SectionCard title="Сегодня" subtitle="Краткая сводка перед началом дня">
              <Text style={styles.metric}>Активных целей: {activeGoals}</Text>
              <Text style={styles.metric}>Чек-ин сегодня: {todayCheckin ? `${todayCheckin.score}/5` : 'нет записи'}</Text>
              <Text style={styles.helper}>Неделя: {weeklySuccess}% последовательности.</Text>
            </SectionCard>
            <SectionCard title="Быстрый чек-ин" subtitle="Отметьте, как прошёл день">
              <View style={styles.scoreRow}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <Pressable
                    key={score}
                    style={[styles.scoreBtn, todayCheckin?.score === score ? styles.scoreBtnActive : null]}
                    onPress={() => saveTodayCheckin(score)}
                  >
                    <Text style={[styles.scoreText, todayCheckin?.score === score ? styles.scoreTextActive : null]}>
                      {score}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SectionCard>
          </>
        ) : null}

        {activeTab === 'settings' ? (
          <>
            <Text style={styles.appTitle}>Основная</Text>
            <Text style={styles.appSubtitle}>Здесь настраиваются цели и напоминания</Text>
            {renderSettingsContent()}
          </>
        ) : null}

        <SectionCard title="4) Прогресс" subtitle="Смотрите динамику за последние 7 дней">
          <Text style={styles.metric}>Успешность недели: {weeklySuccess}%</Text>
          <Text style={styles.metric}>Чек-ин сегодня: {todayCheckin ? `${todayCheckin.score}/5` : 'нет записи'}</Text>
          <Text style={styles.helper}>Регулярность важнее идеала: маленький шаг каждый день.</Text>
        </SectionCard>
        {activeTab === 'profile' ? (
          <>
            <Text style={styles.appTitle}>Профиль</Text>
            <Text style={styles.appSubtitle}>Раздел под будущие функции</Text>
            <SectionCard title="Пока что здесь" subtitle="Базовая информация пользователя">
              <Text style={styles.metric}>Имя: {state.profile.name || 'не указано'}</Text>
              <Text style={styles.helper}>В будущем сюда можно добавить достижения, статистику и настройки аккаунта.</Text>
            </SectionCard>
            <SectionCard title="Заметка дня" subtitle="Один вывод, который хотите запомнить">
              <TextInput
                style={[styles.input, styles.noteInput]}
                placeholder="Короткая заметка: что сработало или помешало"
                value={noteInput}
                onChangeText={setNoteInput}
                multiline
              />
            </SectionCard>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.tabBar}>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('home')}>
          <Text style={[styles.tabText, activeTab === 'home' ? styles.tabTextActive : null]}>Главная</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabText, activeTab === 'settings' ? styles.tabTextActive : null]}>Основная</Text>
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
    paddingBottom: 30,
    paddingBottom: 100,
  },
  appTitle: {
    fontSize: 30,
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
@@ -328,27 +452,85 @@ const styles = StyleSheet.create({
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbe5ff',
  },
  scoreBtnActive: {
    backgroundColor: '#4169e1',
    borderColor: '#4169e1',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3553a1',
  },
  scoreTextActive: {
    color: '#fff',
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
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
    flex: 1,
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
  },
  tabTextActive: {
    color: '#355ad4',
  },
});