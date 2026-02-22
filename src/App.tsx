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
    const days = last7Days();
    const map = new Map(state.checkins.map((item) => [item.date, item.score]));
    const values = days.map((date) => map.get(date) ?? 0);
    const total = values.reduce((acc, score) => acc + score, 0);
    return Math.round((total / (values.length * 5)) * 100);
  }, [state.checkins]);

  const activeGoals = state.goals.filter((goal) => goal.isActive).length;

  const toggleGoal = (category: GoalCategory) => {
    setState((prev) => {
      const exists = prev.goals.find((goal) => goal.category === category);
      if (!exists) {
        return {
          ...prev,
          goals: [...prev.goals, createGoal(category)],
        };
      }

      return {
        ...prev,
        goals: prev.goals.filter((goal) => goal.category !== category),
      };
    });
  };

  const updateGoalAction = (category: GoalCategory, text: string) => {
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
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="Короткая заметка: что сработало или помешало"
            value={noteInput}
            onChangeText={setNoteInput}
            multiline
          />
        </SectionCard>

        <SectionCard title="4) Прогресс" subtitle="Смотрите динамику за последние 7 дней">
          <Text style={styles.metric}>Успешность недели: {weeklySuccess}%</Text>
          <Text style={styles.metric}>Чек-ин сегодня: {todayCheckin ? `${todayCheckin.score}/5` : 'нет записи'}</Text>
          <Text style={styles.helper}>Регулярность важнее идеала: маленький шаг каждый день.</Text>
        </SectionCard>
      </ScrollView>
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
  },
  appTitle: {
    fontSize: 30,
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
    fontSize: 15,
    fontWeight: '600',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbe6ff',
  },
  counterBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2a4dad',
  },
  counterValue: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1c2a52',
  },
  helper: {
    color: '#5d6e95',
    lineHeight: 20,
  },
  input: {
    borderColor: '#d6e1fa',
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#223259',
    marginTop: -4,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ecf1ff',
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
  },
});
