import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { useAppStore } from '../store/AppStore';
import { TRAIT_LABELS, getCharacterInsight, getWeeklyStability } from '../store/selectors';
import { colors, radius, spacing, typography } from '../theme';

interface CharacterScreenProps {
  onOpenProgram: () => void;
}

const TRAIT_TIPS: Record<keyof typeof TRAIT_LABELS, string> = {
  discipline: 'Сохраняй малый ежедневный ритм, даже в загруженные дни.',
  selfControl: 'Пауза перед действием помогает укреплять самоконтроль.',
  emotionalStability: 'Короткое дыхание перед стартом снижает внутренний шум.',
  awareness: 'Отмечай триггер сразу, не после срыва.',
  responsibility: 'Закрывай один обязательный шаг до обеда.',
  confidence: 'Уверенность растет от маленьких побед — фиксируй шаги.',
};

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function CharacterScreen({ onOpenProgram }: CharacterScreenProps) {
  const { state } = useAppStore();
  const hasData = state.logs.length > 0;
  const insight = getCharacterInsight(state);
  const stability = getWeeklyStability(state);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <GlassCard>
        <Text style={styles.cardTitle}>Твой архетип</Text>
        <Text style={styles.archetypeName}>{insight.archetypeName}</Text>
        <Text style={styles.cardSubtitle}>{insight.archetypeDescription}</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.secondaryText}>Уровень {insight.level}</Text>
          <Text style={styles.secondaryText}>Рост за неделю {formatDelta(insight.weeklyGrowth)}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Диаграмма характера</Text>
        <View style={styles.traitList}>
          {(Object.keys(TRAIT_LABELS) as Array<keyof typeof TRAIT_LABELS>).map((key) => {
            const value = Math.round(state.traits[key]);
            return (
              <View key={key} style={styles.traitRow}>
                <View style={styles.traitHeaderRow}>
                  <Text style={styles.traitLabel}>{TRAIT_LABELS[key]}</Text>
                  <Text style={styles.traitValue}>{value}/100</Text>
                </View>
                <View style={styles.traitTrack}>
                  <View style={[styles.traitFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
        {!hasData ? <Text style={styles.secondaryText}>Сделай первые шаги — и диаграмма начнет заполняться.</Text> : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Сильные стороны / зона роста</Text>
        <View style={styles.columnsRow}>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Сильные</Text>
            {insight.topTraits.map((item) => (
              <Text key={`top-${item.key}`} style={styles.bodyText}>
                {TRAIT_LABELS[item.key]} {item.value}
              </Text>
            ))}
            {insight.topTraits[0] ? <Text style={styles.tipText}>{TRAIT_TIPS[insight.topTraits[0].key]}</Text> : null}
          </View>

          <View style={styles.column}>
            <Text style={styles.columnTitle}>Зона роста</Text>
            {insight.bottomTraits.map((item) => (
              <Text key={`low-${item.key}`} style={styles.bodyText}>
                {TRAIT_LABELS[item.key]} {item.value}
              </Text>
            ))}
            {insight.bottomTraits[0] ? <Text style={styles.tipText}>{TRAIT_TIPS[insight.bottomTraits[0].key]}</Text> : null}
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Изменения</Text>
        <Text style={styles.bodyText}>За 7 дней: {formatDelta(insight.weeklyGrowth)}</Text>
        <Text style={styles.bodyText}>За 30 дней: {formatDelta(insight.monthlyGrowth)}</Text>
        <View style={styles.actionTopGap}>
          <PrimaryButton label="История" variant="secondary" onPress={() => {}} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Закрепление</Text>
        <Text style={styles.bodyText}>Стабильных дней за неделю: {stability.stableDays}</Text>
        <Text style={styles.bodyText}>Срывов: {stability.relapses}</Text>
        <Text style={styles.secondaryText}>Это нормально, важно возвращаться.</Text>
      </GlassCard>

      {!hasData ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Старт профиля</Text>
          <Text style={styles.secondaryText}>Диаграмма начнет заполняться после практики.</Text>
          <PrimaryButton label="Перейти к программе" onPress={onOpenProgram} />
        </GlassCard>
      ) : null}
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
  archetypeName: {
    ...typography.h1,
    fontSize: 30,
    marginBottom: spacing.xs,
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  traitList: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  traitRow: {
    gap: spacing.xs,
  },
  traitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  traitLabel: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  traitValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  traitTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  traitFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  columnsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  column: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.md,
  },
  columnTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.caption,
    color: colors.primary2,
    marginTop: spacing.xs,
  },
  actionTopGap: {
    marginTop: spacing.sm,
  },
});
