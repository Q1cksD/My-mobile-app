import { Pressable, StyleSheet, Text } from 'react-native';
import { SectionCard } from '../components/SectionCard';

export type ProfileMenuTarget = 'settings' | 'home' | 'history' | 'premium';

interface ProfileMenuScreenProps {
  name: string;
  isPremium: boolean;
  onNavigate: (target: ProfileMenuTarget) => void;
}

export function ProfileMenuScreen({ name, isPremium, onNavigate }: ProfileMenuScreenProps) {
  return (
    <>
      <Text style={styles.appTitle}>Профиль</Text>
      <Text style={styles.appSubtitle}>Меню приложения и статус аккаунта</Text>

      <SectionCard title="Аккаунт">
        <Text style={styles.metric}>Имя: {name || 'не указано'}</Text>
        <Text style={styles.metric}>Статус: {isPremium ? 'Premium' : 'Free'}</Text>
      </SectionCard>

      <SectionCard title="Пункты меню">
        <Pressable style={styles.menuBtn} onPress={() => onNavigate('settings')}>
          <Text style={styles.menuBtnText}>Настройки (основной экран)</Text>
        </Pressable>
        <Pressable style={styles.menuBtn} onPress={() => onNavigate('home')}>
          <Text style={styles.menuBtnText}>Главная</Text>
        </Pressable>
        <Pressable style={styles.menuBtn} onPress={() => onNavigate('history')}>
          <Text style={styles.menuBtnText}>История</Text>
        </Pressable>
        <Pressable style={styles.menuBtn} onPress={() => onNavigate('premium')}>
          <Text style={styles.menuBtnText}>Premium</Text>
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
  metric: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d2b50',
    marginBottom: 6,
  },
  menuBtn: {
    borderWidth: 1,
    borderColor: '#d7e2ff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  menuBtnText: {
    color: '#3553a1',
    fontWeight: '700',
  },
});
