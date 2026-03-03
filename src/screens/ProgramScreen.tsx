import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../components/ui/Card';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { StartedOnTime } from '../domain/app/types';
import { getActiveTechniqueGuides, getDisciplineTechniqueById } from '../domain/discipline/techniques';
import { useAppStore } from '../store/AppStore';
import { getDayInChapter, getTodayLog } from '../store/selectors';
import { colors, radius, spacing, typography } from '../theme';

interface ProgramScreenProps {
  onOpenTechniques: () => void;
  onOpenTechniqueDetails: (techniqueId: string) => void;
}

const START_OPTIONS: Array<{ key: StartedOnTime; label: string }> = [
  { key: 'on_time', label: 'Вовремя' },
  { key: 'late', label: 'Позже' },
  { key: 'very_late', label: 'Сильно позже' },
];

const OBSTACLE_OPTIONS = ['Телефон', 'Усталость', 'Суета', 'Перфекционизм'];

export function ProgramScreen({ onOpenTechniques, onOpenTechniqueDetails }: ProgramScreenProps) {
  const { state, completeTodayQuest, setActiveDirection } = useAppStore();
  const todayLog = useMemo(() => getTodayLog(state), [state]);
  const dayInChapter = useMemo(() => getDayInChapter(state), [state]);
  const activeDirection = state.program.activeDirection || state.program.selectedDirections[0] || 'discipline';

  const selectedTechniques = useMemo(
    () =>
      state.disciplineTechniquesSelected
        .map((id) => getDisciplineTechniqueById(id))
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [state.disciplineTechniquesSelected],
  );

  const activeTechniqueGuides = useMemo(
    () => getActiveTechniqueGuides(state.disciplineTechniquesActive).slice(0, 3),
    [state.disciplineTechniquesActive],
  );

  const [questStarted, setQuestStarted] = useState(false);
  const [questDoneDraft, setQuestDoneDraft] = useState(Boolean(todayLog?.questCompleted));
  const [startedOnTime, setStartedOnTime] = useState<StartedOnTime>(todayLog?.startedOnTime ?? 'on_time');
  const [resistance, setResistance] = useState<1 | 2 | 3 | 4 | 5>(todayLog?.resistance ?? 3);
  const [obstacles, setObstacles] = useState<string[]>(todayLog?.obstacles ?? []);
  const [reflectionText, setReflectionText] = useState(todayLog?.reflectionText ?? '');

  useEffect(() => {
    setQuestDoneDraft(Boolean(todayLog?.questCompleted));
    setStartedOnTime(todayLog?.startedOnTime ?? 'on_time');
    setResistance(todayLog?.resistance ?? 3);
    setObstacles(todayLog?.obstacles ?? []);
    setReflectionText(todayLog?.reflectionText ?? '');
  }, [todayLog]);

  const hasBeacon = Boolean(state.user.motivationPhrase.trim() || state.user.motivationTags.length || state.user.motivationPhotoUri);
  const shouldShowReflection = questDoneDraft && !todayLog?.questCompleted;
  const hasSelectedTechniques = selectedTechniques.length > 0;
  const hasActiveGuides = activeTechniqueGuides.length > 0;

  const toggleObstacle = (item: string) => {
    setObstacles((prev) => (prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item]));
  };

  const saveReflection = () => {
    completeTodayQuest({
      startedOnTime,
      resistance,
      obstacles,
      reflectionText: reflectionText.trim() || undefined,
      usedTechniqueId: activeTechniqueGuides[0]?.id,
    });
    setQuestDoneDraft(true);
    Alert.alert('Сохранено', 'День закрыт. Прогресс и характер обновлены.');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pathText}>
        Этап {Math.min(dayInChapter, state.program.chapterLengthDays)} / {state.program.chapterLengthDays}
      </Text>

      <Card title="Текущий фокус">
        <Text style={styles.mainLine}>Направление: {activeDirection === 'discipline' ? 'Дисциплина' : activeDirection}</Text>
        <View style={styles.directionRow}>
          {state.program.selectedDirections.map((direction) => {
            const isActive = direction === activeDirection;
            return (
              <Pressable
                key={direction}
                style={[styles.directionChip, isActive ? styles.directionChipActive : null]}
                onPress={() => setActiveDirection(direction)}
              >
                <Text style={[styles.directionChipText, isActive ? styles.directionChipTextActive : null]}>
                  {direction === 'discipline' ? 'Дисциплина' : direction}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title="Маяк мотивации">
        {hasBeacon ? (
          <>
            <Text style={styles.mainLine}>
              {state.user.motivationPhrase.trim() || `Я делаю это ради: ${state.user.motivationTags.join(', ')}`}
            </Text>
            <Text style={styles.subLine}>
              {state.user.name
                ? `${state.user.name}, возвращайся к этой опоре, когда станет тяжело.`
                : 'Возвращайся к этой опоре, когда станет тяжело.'}
            </Text>
          </>
        ) : (
          <GlassCard style={styles.innerCard}>
            <Text style={styles.emptyLine}>Точка опоры пока не настроена.</Text>
            <Text style={styles.subLine}>Заполни мотивацию в онбординге, чтобы усилить устойчивость на дистанции.</Text>
            <PrimaryButton
              label="Настроить точку опоры"
              variant="secondary"
              onPress={() => Alert.alert('Скоро', 'Экран редактирования точки опоры будет добавлен отдельно.')}
            />
          </GlassCard>
        )}
      </Card>

      <Card title="Ваши техники">
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.counterText}>Выбрано: {selectedTechniques.length}</Text>
          <Pressable style={styles.changeButton} onPress={onOpenTechniques}>
            <Text style={styles.changeButtonText}>Изменить</Text>
          </Pressable>
        </View>

        {hasSelectedTechniques ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
            {selectedTechniques.map((technique) => {
              const isActive = state.disciplineTechniquesActive.includes(technique.id);
              return (
                <GlassCard key={technique.id} style={styles.techniqueSlide}>
                  <View style={styles.slideTopRow}>
                    <Text style={styles.slideTitle}>{technique.titleRu}</Text>
                    {isActive ? (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Активна</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.slideShort}>{technique.shortRu}</Text>
                  <Pressable onPress={() => onOpenTechniqueDetails(technique.id)}>
                    <Text style={styles.detailsLink}>Подробнее</Text>
                  </Pressable>
                </GlassCard>
              );
            })}
          </ScrollView>
        ) : (
          <>
            <Text style={styles.emptyLine}>Выбери техники, которые тебе подходят.</Text>
            <PrimaryButton label="Выбрать" onPress={onOpenTechniques} />
          </>
        )}
      </Card>

      {!todayLog?.questCompleted ? (
        <>
          <Card title="Задание дня">
            <Text style={styles.mainLine}>Сделай один осознанный шаг по фокусу дня и зафиксируй результат.</Text>
            <Text style={styles.subLine}>После выполнения отметь день и заполни рефлексию.</Text>

            {hasActiveGuides ? (
              <View style={styles.activeTechniquesWrap}>
                <Text style={styles.questionTitle}>Активные техники</Text>
                {activeTechniqueGuides.map((guide) => (
                  <Pressable key={guide.id} style={styles.activeGuideCard} onPress={() => onOpenTechniqueDetails(guide.id)}>
                    <Text style={styles.activeGuideTitle}>{guide.title}</Text>
                    <Text style={styles.activeGuideHint}>{guide.hintText}</Text>
                  </Pressable>
                ))}
              </View>
            ) : hasSelectedTechniques ? (
              <View style={styles.activeTechniquesWrap}>
                <Text style={styles.emptyLine}>
                  Выбери до 3 активных техник — по ним будут подсказки и уведомления.
                </Text>
                <PrimaryButton label="Настроить активные" variant="secondary" onPress={onOpenTechniques} />
              </View>
            ) : (
              <View style={styles.activeTechniquesWrap}>
                <Text style={styles.emptyLine}>Сначала выбери техники, чтобы получать персональные подсказки.</Text>
                <PrimaryButton label="Выбрать техники" variant="secondary" onPress={onOpenTechniques} />
              </View>
            )}

            {!questStarted ? (
              <PrimaryButton label="Старт" onPress={() => setQuestStarted(true)} />
            ) : (
              <>
                <Text style={styles.subLine}>Задание в процессе. Когда завершишь, отметь выполнение ниже.</Text>
                <PrimaryButton label="Отметить выполненным" onPress={() => setQuestDoneDraft(true)} />
              </>
            )}
          </Card>

          {shouldShowReflection ? (
            <Card title="Рефлексия">
              <Text style={styles.questionTitle}>Сопротивление (1-5)</Text>
              <View style={styles.optionRowWrap}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const typedValue = value as 1 | 2 | 3 | 4 | 5;
                  const active = resistance === typedValue;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.optionChip, active ? styles.optionChipActive : null]}
                      onPress={() => setResistance(typedValue)}
                    >
                      <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.questionTitle}>Начал вовремя</Text>
              <View style={styles.optionRowWrap}>
                {START_OPTIONS.map((item) => {
                  const active = startedOnTime === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.optionChipWide, active ? styles.optionChipActive : null]}
                      onPress={() => setStartedOnTime(item.key)}
                    >
                      <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.questionTitle}>Что мешало</Text>
              <View style={styles.optionRowWrap}>
                {OBSTACLE_OPTIONS.map((item) => {
                  const active = obstacles.includes(item);
                  return (
                    <Pressable
                      key={item}
                      style={[styles.optionChipWide, active ? styles.optionChipActive : null]}
                      onPress={() => toggleObstacle(item)}
                    >
                      <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={styles.input}
                value={reflectionText}
                onChangeText={setReflectionText}
                placeholder="Короткая заметка о дне (необязательно)"
                placeholderTextColor={colors.text3}
                multiline
              />

              <PrimaryButton label="Сохранить" onPress={saveReflection} />
            </Card>
          ) : null}
        </>
      ) : (
        <Card title="Сегодняшний итог">
          <Text style={styles.mainLine}>Задание на сегодня уже закрыто.</Text>
          <Text style={styles.subLine}>
            Сопротивление: {todayLog.resistance}/5, старт:{' '}
            {todayLog.startedOnTime === 'on_time' ? 'вовремя' : todayLog.startedOnTime === 'late' ? 'позже' : 'сильно позже'}.
          </Text>
          <Text style={styles.subLine}>Прогресс и характер уже обновлены на основе этого дня.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pathText: {
    ...typography.caption,
    marginBottom: spacing.sm,
    color: colors.text3,
  },
  mainLine: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  subLine: {
    ...typography.body,
    color: colors.text2,
    marginTop: spacing.xs,
  },
  emptyLine: {
    ...typography.body,
    color: colors.text2,
  },
  innerCard: {
    marginBottom: 0,
  },
  directionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  directionChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  directionChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  directionChipText: {
    color: colors.text3,
    fontWeight: '600',
  },
  directionChipTextActive: {
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  counterText: {
    ...typography.caption,
    color: colors.text3,
  },
  changeButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  changeButtonText: {
    color: colors.text2,
    fontWeight: '600',
    fontSize: 12,
  },
  carouselContent: {
    paddingRight: spacing.sm,
  },
  techniqueSlide: {
    width: 250,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  slideTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  slideTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  slideShort: {
    ...typography.body,
    color: colors.text2,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  activeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 11,
  },
  detailsLink: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '700',
  },
  activeTechniquesWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  activeGuideCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.md,
  },
  activeGuideTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  activeGuideHint: {
    ...typography.body,
    color: colors.text2,
  },
  questionTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontWeight: '700',
  },
  optionRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  optionChip: {
    minWidth: 38,
    height: 36,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  optionChipWide: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    backgroundColor: 'transparent',
  },
  optionChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.25)',
  },
  optionChipText: {
    color: colors.text3,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 76,
    textAlignVertical: 'top',
  },
});
