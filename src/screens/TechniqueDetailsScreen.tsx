import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { getDisciplineTechniqueById } from '../domain/discipline/techniques';
import { useAppStore } from '../store/AppStore';
import { colors, radius, spacing, typography } from '../theme';

interface TechniqueDetailsScreenProps {
  techniqueId: string;
  onBack: () => void;
}

export function TechniqueDetailsScreen({ techniqueId, onBack }: TechniqueDetailsScreenProps) {
  const { state, selectTechnique, unselectTechnique, setActiveTechnique } = useAppStore();
  const technique = getDisciplineTechniqueById(techniqueId);

  if (!technique) {
    return (
      <View style={styles.root}>
        <GlassCard>
          <Text style={styles.title}>Техника не найдена</Text>
          <PrimaryButton label="Назад" variant="secondary" onPress={onBack} />
        </GlassCard>
      </View>
    );
  }

  const isSelected = state.disciplineTechniquesSelected.includes(technique.id);
  const isActive = state.disciplineTechniquesActive.includes(technique.id);
  const descriptionParagraphs = technique.descriptionRu.split('\n\n').filter(Boolean);

  const toggleSelected = () => {
    if (isSelected) {
      unselectTechnique(technique.id);
      return;
    }
    selectTechnique(technique.id);
  };

  const toggleActive = () => {
    const ok = setActiveTechnique(technique.id, !isActive);
    if (!ok) {
      Alert.alert(
        'Лимит активных техник',
        'Можно активировать только 3 техники. Отключите одну из активных, чтобы включить другую.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <GlassCard>
        <Text style={styles.title}>{technique.titleRu}</Text>
        <Text style={styles.short}>{technique.shortRu}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Описание</Text>
        {descriptionParagraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Как применять</Text>
        {technique.howToRu.map((step, index) => (
          <Text key={step} style={styles.listItem}>
            {index + 1}. {step}
          </Text>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Примеры</Text>
        {technique.examplesRu.map((example) => (
          <Text key={example} style={styles.listItem}>
            • {example}
          </Text>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Советы</Text>
        {technique.tipsRu.map((tip) => (
          <Text key={tip} style={styles.listItem}>
            • {tip}
          </Text>
        ))}
      </GlassCard>

      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionChip, isSelected ? styles.actionChipActive : null]} onPress={toggleSelected}>
          <Text style={[styles.actionChipText, isSelected ? styles.actionChipTextActive : null]}>
            {isSelected ? 'Убрать из выбранных' : 'Добавить в выбранные'}
          </Text>
        </Pressable>

        <Pressable style={[styles.actionChip, isActive ? styles.actionChipActive : null]} onPress={toggleActive}>
          <Text style={[styles.actionChipText, isActive ? styles.actionChipTextActive : null]}>
            {isActive ? 'Снять активность' : 'Сделать активной'}
          </Text>
        </Pressable>
      </View>

      <PrimaryButton label="Назад" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  short: {
    ...typography.body,
    color: colors.text2,
  },
  sectionTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.text2,
    marginBottom: spacing.sm,
  },
  listItem: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  actionsRow: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actionChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  actionChipText: {
    color: colors.text2,
    fontWeight: '600',
    fontSize: 13,
  },
  actionChipTextActive: {
    color: colors.text,
  },
});
