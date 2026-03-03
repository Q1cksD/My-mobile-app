import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { GlassCard } from './GlassCard';

interface CardProps {
  title: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <GlassCard>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  content: {
    gap: spacing.sm,
  },
});
