import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';

interface PremiumScreenProps {
  isPremium: boolean;
  onTogglePremium: () => void;
  onContinueFree: () => void;
}

export function PremiumScreen({ isPremium, onTogglePremium, onContinueFree }: PremiumScreenProps) {
  return (
    <>
      <Text style={styles.appTitle}>Premium</Text>
      <Text style={styles.appSubtitle}>Paywall-скелет для будущей монетизации</Text>

      <SectionCard title="Что входит">
        <Text style={styles.helper}>• История на 14 и 30 дней</Text>
        <Text style={styles.helper}>• Расширенная аналитика</Text>
        <Text style={styles.helper}>• В будущем: экспорт и персональные планы</Text>
      </SectionCard>

      <SectionCard title="Тарифы">
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Monthly</Text>
          <Text style={styles.planPrice}>199 ₽ / месяц</Text>
          <Text style={styles.helper}>Автопродление, отмена в любой момент</Text>
        </View>
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Yearly</Text>
          <Text style={styles.planPrice}>1490 ₽ / год</Text>
          <Text style={styles.helper}>Экономия относительно помесячной оплаты</Text>
        </View>
        <Pressable style={[styles.primaryBtn, styles.disabledBtn]} disabled>
          <Text style={styles.primaryBtnText}>Оформить (скоро)</Text>
        </Pressable>
        <Pressable style={[styles.secondaryBtn, styles.fullWidthBtn]} onPress={onContinueFree}>
          <Text style={styles.secondaryBtnText}>Пока продолжить без Premium</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="Demo режим">
        <Text style={styles.helper}>Временная кнопка для тестирования премиум-контента до интеграции оплаты.</Text>
        <Pressable style={styles.secondaryBtn} onPress={onTogglePremium}>
          <Text style={styles.secondaryBtnText}>
            {isPremium ? 'Выключить Premium (demo)' : 'Включить Premium (demo)'}
          </Text>
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
  helper: {
    color: '#5b6e99',
    lineHeight: 20,
    marginTop: 4,
  },
  planCard: {
    borderWidth: 1,
    borderColor: '#d7e2ff',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8fbff',
    marginBottom: 8,
  },
  planTitle: {
    color: '#1f356a',
    fontWeight: '800',
    fontSize: 16,
  },
  planPrice: {
    color: '#3553a1',
    fontWeight: '700',
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b8c8ec',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    color: '#3f568f',
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#4169e1',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  fullWidthBtn: {
    flex: undefined,
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
