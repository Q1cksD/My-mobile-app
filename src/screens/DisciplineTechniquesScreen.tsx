import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { DISCIPLINE_TECHNIQUES } from '../domain/discipline/techniques';
import { useAppStore } from '../store/AppStore';
import { colors, radius, spacing, typography } from '../theme';

interface DisciplineTechniquesScreenProps {
  isFirstSetup: boolean;
  onDone: () => void;
  onOpenDetails: (techniqueId: string) => void;
}

export function DisciplineTechniquesScreen({ isFirstSetup, onDone, onOpenDetails }: DisciplineTechniquesScreenProps) {
  const { state, selectTechnique, unselectTechnique, setActiveTechnique, setHasChosenTechniques } = useAppStore();

  const selectedCount = state.disciplineTechniquesSelected.length;
  const activeCount = state.disciplineTechniquesActive.length;

  const toggleSelected = (id: string) => {
    if (state.disciplineTechniquesSelected.includes(id)) {
      unselectTechnique(id);
      return;
    }
    selectTechnique(id);
  };

  const toggleActive = (id: string) => {
    const shouldActivate = !state.disciplineTechniquesActive.includes(id);
    const ok = setActiveTechnique(id, shouldActivate);
    if (!ok) {
      Alert.alert(
        'Лимит активных техник',
        'Можно активировать только 3 техники. Отключите одну из активных, чтобы включить другую.',
      );
    }
  };

  const finish = () => {
    if (isFirstSetup) {
      setHasChosenTechniques(true);
    }
    onDone();
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={DISCIPLINE_TECHNIQUES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <GlassCard>
            <Text style={styles.title}>Техники дисциплины</Text>
            <Text style={styles.metaText}>Выбрано: {selectedCount}</Text>
            <Text style={styles.metaText}>Активно: {activeCount}/3</Text>
            <Text style={styles.captionText}>Активные техники используются в подсказках и уведомлениях.</Text>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const isSelected = state.disciplineTechniquesSelected.includes(item.id);
          const isActive = state.disciplineTechniquesActive.includes(item.id);

          return (
            <GlassCard style={styles.card}>
              <View style={styles.rowTop}>
                <Pressable style={styles.selectWrap} onPress={() => toggleSelected(item.id)}>
                  <View style={[styles.checkbox, isSelected ? styles.checkboxActive : null]}>
                    {isSelected ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <View style={styles.titleWrap}>
                    <Text style={styles.cardTitle}>{item.titleRu}</Text>
                    <Text style={styles.cardShort}>{item.shortRu}</Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.actionsRow}>
                <Pressable style={[styles.actionChip, isActive ? styles.actionChipActive : null]} onPress={() => toggleActive(item.id)}>
                  <Text style={[styles.actionChipText, isActive ? styles.actionChipTextActive : null]}>
                    {isActive ? 'Активная' : 'Сделать активной'}
                  </Text>
                </Pressable>

                <Pressable style={styles.actionChip} onPress={() => onOpenDetails(item.id)}>
                  <Text style={styles.actionChipText}>Подробнее</Text>
                </Pressable>
              </View>
            </GlassCard>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <PrimaryButton label={isFirstSetup ? 'Продолжить' : 'Готово'} onPress={finish} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h2,
  },
  metaText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.xs,
  },
  captionText: {
    ...typography.caption,
    color: colors.text3,
    marginTop: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  rowTop: {
    marginBottom: spacing.sm,
  },
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.text3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxTick: {
    color: colors.text,
    fontWeight: '800',
  },
  titleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  cardShort: {
    ...typography.caption,
    color: colors.text2,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  actionChipText: {
    color: colors.text2,
    fontWeight: '600',
    fontSize: 12,
  },
  actionChipTextActive: {
    color: colors.text,
  },
  footer: {
    marginTop: spacing.sm,
  },
});
