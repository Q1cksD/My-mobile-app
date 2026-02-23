import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { DailyCheckin } from '../types';

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

interface HomeScreenProps {
  userName: string;
  activeGoals: number;
  weeklySuccess: number;
  todayCheckin: DailyCheckin | undefined;
  checkinScore: number | null;
  checkinNote: string;
  onScoreChange: (score: number) => void;
  onNoteChange: (text: string) => void;
  onSaveCheckin: () => void;
}

export function HomeScreen({
  userName,
  activeGoals,
  weeklySuccess,
  todayCheckin,
  checkinScore,
  checkinNote,
  onScoreChange,
  onNoteChange,
  onSaveCheckin,
}: HomeScreenProps) {
  return (
    <>
      <Text style={styles.appTitle}>Главная</Text>
      <Text style={styles.appSubtitle}>С возвращением, {userName || 'друг'}</Text>

      <SectionCard title="Сегодня" subtitle="Краткая сводка перед началом дня">
        <Text style={styles.metric}>Активных целей: {activeGoals}</Text>
        <Text style={styles.metric}>Чек-ин сегодня: {todayCheckin ? `${todayCheckin.score}/5` : 'нет записи'}</Text>
        <Text style={styles.helper}>Неделя: {weeklySuccess}% последовательности.</Text>
      </SectionCard>

      <SectionCard title="Ежедневный чек-ин" subtitle="Оцените день и добавьте заметку в одном месте">
        <View style={styles.scoreRow}>
          {SCORE_OPTIONS.map((score) => (
            <Pressable
              key={score}
              style={[styles.scoreBtn, checkinScore === score ? styles.scoreBtnActive : null]}
              onPress={() => onScoreChange(score)}
            >
              <Text style={[styles.scoreText, checkinScore === score ? styles.scoreTextActive : null]}>{score}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Короткая заметка по дню"
          value={checkinNote}
          onChangeText={onNoteChange}
          multiline
        />

        <Pressable style={styles.primaryBtn} onPress={onSaveCheckin}>
          <Text style={styles.primaryBtnText}>{todayCheckin ? 'Обновить чек-ин' : 'Сохранить чек-ин'}</Text>
        </Pressable>
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
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
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scoreBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#fff',
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
    minHeight: 80,
    textAlignVertical: 'top',
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
});
