import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { useAppStore } from '../store/AppStore';
import { ProgressSummary, getDayInChapter, getDaysToNextCheckpoint, getProgressSummary, getProgressTrend, getTimeline } from '../store/selectors';
import { colors, radius, spacing, typography } from '../theme';

type TrendMetric = 'resistance' | 'completion' | 'stability';

interface ProgressScreenProps {
  onOpenProgram: () => void;
}

const TREND_OPTIONS: Array<{ key: TrendMetric; label: string }> = [
  { key: 'resistance', label: 'Сопротивление' },
  { key: 'completion', label: 'Выполнение' },
  { key: 'stability', label: 'Стабильность' },
];

function milestoneLabel(days: 3 | 7 | 30): string {
  if (days === 3) {
    return '3 дня';
  }
  return `${days} дней`;
}

function formatShortDate(iso: string): string {
  if (!iso) {
    return '--.--';
  }
  return iso.slice(5).split('-').reverse().join('.');
}

function getTrendValue(metric: TrendMetric, point: { resistance: number; completion: number; stability: number }): number {
  if (metric === 'resistance') {
    return point.resistance * 20;
  }
  if (metric === 'completion') {
    return point.completion;
  }
  return point.stability;
}

function eventDotColor(tone: 'neutral' | 'positive' | 'recovery'): string {
  if (tone === 'positive') {
    return '#8E7BFF';
  }
  if (tone === 'recovery') {
    return '#6EC6FF';
  }
  return 'rgba(255,255,255,0.45)';
}

function SummaryCard({
  title,
  summary,
  showOnTimeRate,
}: {
  title: string;
  summary: ProgressSummary;
  showOnTimeRate?: boolean;
}) {
  return (
    <GlassCard>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bodyText}>
        Выполнено задач: {summary.completed} из {summary.total}
      </Text>
      <Text style={styles.bodyText}>
        Среднее сопротивление: {summary.averageResistance !== null ? `${summary.averageResistance}/5` : 'нет данных'}
      </Text>
      <Text style={styles.bodyText}>Частое препятствие: {summary.topObstacle ?? 'пока не определилось'}</Text>
      {showOnTimeRate ? <Text style={styles.bodyText}>Старт вовремя: {summary.onTimeRate}%</Text> : null}
      <Text style={styles.recommendationText}>
        {summary.averageResistance !== null && summary.averageResistance >= 3.5
          ? 'Сделай старт проще: начни с 5 минут и убери телефон.'
          : 'Продолжай маленькие шаги: стабильность важнее идеальности.'}
      </Text>
    </GlassCard>
  );
}

export function ProgressScreen({ onOpenProgram }: ProgressScreenProps) {
  const { state } = useAppStore();
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('stability');

  const hasLogs = state.logs.length > 0;
  const dayInChapter = useMemo(() => getDayInChapter(state), [state]);
  const daysToNextCheckpoint = useMemo(() => getDaysToNextCheckpoint(state), [state]);
  const summary3d = useMemo(() => getProgressSummary(state, 3), [state]);
  const summary7d = useMemo(() => getProgressSummary(state, 7), [state]);
  const trend = useMemo(() => getProgressTrend(state, 14), [state]);
  const timeline = useMemo(() => getTimeline(state, 10), [state]);

  if (!hasLogs) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard>
          <Text style={styles.cardTitle}>Прогресс</Text>
          <Text style={styles.cardSubtitle}>Сделай первые шаги — здесь появится прогресс.</Text>
          <PrimaryButton label="Перейти к программе" onPress={onOpenProgram} />
        </GlassCard>

        <GlassCard>
          <Text style={styles.cardTitle}>Что появится после старта</Text>
          <Text style={styles.bodyText}>• Итоги за 3, 7 и 30 дней</Text>
          <Text style={styles.bodyText}>• Тренд сопротивления и стабильности</Text>
          <Text style={styles.bodyText}>• Лента событий без давления и вины</Text>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <GlassCard>
        <Text style={styles.cardTitle}>Курс</Text>
        <Text style={styles.cardSubtitle}>Ты на пути. Маленькие шаги складываются в характер.</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.secondaryText}>Фокус: {state.program.activeDirection || 'Дисциплина'}</Text>
          <Text style={styles.secondaryText}>Этап {dayInChapter} / {state.program.chapterLengthDays}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(0, Math.min(100, (dayInChapter / state.program.chapterLengthDays) * 100))}%` },
            ]}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Ближайший этап</Text>
        <Text style={styles.bodyText}>До следующего итога: {daysToNextCheckpoint} дней</Text>
        <Text style={styles.secondaryText}>Итоги помогают увидеть рост и скорректировать курс.</Text>
        <View style={styles.badgesRow}>
          {[3, 7, 30].map((milestone) => {
            const reached = dayInChapter >= milestone;
            return (
              <View key={milestone} style={[styles.milestoneBadge, reached ? styles.milestoneBadgeActive : null]}>
                <Text style={[styles.milestoneText, reached ? styles.milestoneTextActive : null]}>
                  {milestoneLabel(milestone as 3 | 7 | 30)}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <SummaryCard title="Итог за 3 дня" summary={summary3d} />
      <SummaryCard title="Неделя" summary={summary7d} showOnTimeRate />

      <GlassCard>
        <Text style={styles.cardTitle}>Тренд</Text>
        <View style={styles.chipsRow}>
          {TREND_OPTIONS.map((item) => {
            const active = trendMetric === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.metricChip, active ? styles.metricChipActive : null]}
                onPress={() => setTrendMetric(item.key)}
              >
                <Text style={[styles.metricChipText, active ? styles.metricChipTextActive : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.trendChartRow}>
          {trend.map((point) => {
            const normalized = Math.max(0.08, Math.min(1, getTrendValue(trendMetric, point) / 100));
            return <View key={`${trendMetric}-${point.date}`} style={[styles.trendBar, { height: `${normalized * 100}%` }]} />;
          })}
        </View>
        <View style={styles.trendLegendRow}>
          <Text style={styles.tertiaryText}>{formatShortDate(trend[0]?.date ?? '')}</Text>
          <Text style={styles.tertiaryText}>{formatShortDate(trend[trend.length - 1]?.date ?? '')}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Лента событий</Text>
        {timeline.map((item) => (
          <View key={item.id} style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: eventDotColor(item.tone) }]} />
            <View style={styles.timelineTextWrap}>
              <Text style={styles.bodyText}>{item.title}</Text>
              <Text style={styles.tertiaryText}>{formatShortDate(item.date)}</Text>
            </View>
          </View>
        ))}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  cardTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.text2,
    marginBottom: spacing.md,
  },
  bodyText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  secondaryText: {
    ...typography.body,
    color: colors.text2,
    marginBottom: spacing.xs,
  },
  tertiaryText: {
    ...typography.caption,
    color: colors.text3,
  },
  recommendationText: {
    ...typography.body,
    color: colors.primary2,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  milestoneBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  milestoneBadgeActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  milestoneText: {
    color: colors.text2,
    fontWeight: '600',
    fontSize: 12,
  },
  milestoneTextActive: {
    color: colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricChip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  metricChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  metricChipText: {
    color: colors.text3,
    fontWeight: '600',
    fontSize: 12,
  },
  metricChipTextActive: {
    color: colors.text,
  },
  trendChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 96,
    marginBottom: spacing.sm,
  },
  trendBar: {
    width: 12,
    backgroundColor: 'rgba(124,92,255,0.85)',
    borderRadius: 6,
    minHeight: 8,
  },
  trendLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 8,
    marginRight: spacing.sm,
  },
  timelineTextWrap: {
    flex: 1,
  },
});
