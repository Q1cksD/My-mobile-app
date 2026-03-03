import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { spacing, typography } from '../theme';

interface DisciplineTechniquesIntroScreenProps {
  isFirstSetup: boolean;
  onContinue: () => void;
  onSkip: () => void;
}

export function DisciplineTechniquesIntroScreen({
  isFirstSetup,
  onContinue,
  onSkip,
}: DisciplineTechniquesIntroScreenProps) {
  return (
    <View style={styles.root}>
      <GlassCard>
        <Text style={styles.title}>Техники дисциплины</Text>
        <Text style={styles.text}>
          Сейчас ты выберешь техники, которые помогут тренировать дисциплину.
        </Text>
        <Text style={styles.text}>
          Выбирай те, что ближе тебе по духу — ты сможешь менять выбор в любой момент.
        </Text>
      </GlassCard>

      <View style={styles.actions}>
        <PrimaryButton label="Далее" onPress={onContinue} />
        <PrimaryButton label={isFirstSetup ? 'Назад' : 'Позже'} variant="secondary" onPress={onSkip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
