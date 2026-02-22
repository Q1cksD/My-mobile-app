import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GoalTemplate, UserGoal } from '../types';

interface GoalCardProps {
  template: GoalTemplate;
  selected: UserGoal | undefined;
  onToggle: (id: GoalTemplate['id']) => void;
}

export function GoalCard({ template, selected, onToggle }: GoalCardProps) {
  const isSelected = Boolean(selected);

  return (
    <Pressable
      style={[styles.card, isSelected ? styles.cardActive : null]}
      onPress={() => onToggle(template.id)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{template.title}</Text>
        <Text style={[styles.badge, isSelected ? styles.badgeActive : null]}>
          {isSelected ? 'Выбрано' : 'Добавить'}
        </Text>
      </View>
      <Text style={styles.description}>{template.description}</Text>
      {selected?.customAction ? <Text style={styles.action}>Цель: {selected.customAction}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e8f5',
    padding: 14,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: '#4169e1',
    backgroundColor: '#f5f8ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1d2b50',
  },
  badge: {
    fontSize: 12,
    color: '#5f6f90',
    backgroundColor: '#edf2ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeActive: {
    backgroundColor: '#4169e1',
    color: '#fff',
  },
  description: {
    color: '#384766',
    lineHeight: 20,
  },
  action: {
    marginTop: 8,
    color: '#24439e',
    fontWeight: '500',
  },
});
