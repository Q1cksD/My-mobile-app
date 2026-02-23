import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { DailyCheckin } from '../types';
import { displayDate } from '../utils/date';

export type HistoryRange = 7 | 14 | 30;

const HISTORY_RANGES: HistoryRange[] = [7, 14, 30];

export interface HistorySummary {
  records: DailyCheckin[];
  average: string;
  strongDays: number;
  completion: number;
}

interface HistoryScreenProps {
  historyRange: HistoryRange;
  historyData: HistorySummary;
  isPremium: boolean;
  onRangeSelect: (range: HistoryRange) => void;
  onOpenPremium: () => void;
}

export function HistoryScreen({
  historyRange,
  historyData,
  isPremium,
  onRangeSelect,
  onOpenPremium,
}: HistoryScreenProps) {
  return (
    <>
      <Text style={styles.appTitle}>История</Text>
      <Text style={styles.appSubtitle}>Статистика за 7, 14 или 30 дней</Text>

      <SectionCard title="Период">
        <View style={styles.rangeRow}>
          {HISTORY_RANGES.map((range) => {
            const locked = !isPremium && range > 7;
            const selected = historyRange === range;

            return (
              <Pressable
                key={range}
                style={[styles.rangeBtn, selected ? styles.rangeBtnActive : null]}
                onPress={() => {
                  if (locked) {
                    onOpenPremium();
                    return;
                  }

                  onRangeSelect(range);
                }}
              >
                <Text style={[styles.rangeText, selected ? styles.rangeTextActive : null]}>
                  {range}д{locked ? ' (PRO)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!isPremium ? <Text style={styles.helper}>14 и 30 дней доступны в Premium.</Text> : null}
      </SectionCard>

      <SectionCard title="Метрики">
        <Text style={styles.metric}>Записей: {historyData.records.length}</Text>
        <Text style={styles.metric}>Средний балл: {historyData.average}</Text>
        <Text style={styles.metric}>Дней с 4-5 баллами: {historyData.strongDays}</Text>
        <Text style={styles.metric}>Дисциплина: {historyData.completion}%</Text>
      </SectionCard>

      <SectionCard title="Последние записи">
        {historyData.records.length === 0 ? (
          <Text style={styles.helper}>За выбранный период пока нет чек-инов.</Text>
        ) : (
          historyData.records.map((item) => (
            <View key={item.date} style={styles.historyRow}>
              <View>
                <Text style={styles.historyDate}>{displayDate(item.date)}</Text>
                <Text style={styles.historyNote}>{item.note || 'Без заметки'}</Text>
              </View>
              <Text style={styles.historyScore}>{item.score}/5</Text>
            </View>
          ))
        )}
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
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d2deff',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  rangeBtnActive: {
    backgroundColor: '#4169e1',
    borderColor: '#4169e1',
  },
  rangeText: {
    color: '#3e5aa4',
    fontWeight: '700',
  },
  rangeTextActive: {
    color: '#fff',
  },
  historyRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf2ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyDate: {
    color: '#27407d',
    fontWeight: '700',
  },
  historyNote: {
    color: '#667da7',
    maxWidth: 230,
  },
  historyScore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2249b7',
  },
});
