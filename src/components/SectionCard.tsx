import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dfe7fa',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d2b50',
  },
  subtitle: {
    fontSize: 13,
    color: '#596887',
    marginTop: 4,
  },
  content: {
    marginTop: 12,
    gap: 10,
  },
});
