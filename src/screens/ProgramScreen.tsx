import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Card } from '../components/ui/Card';
import { GlassCard } from '../components/ui/GlassCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { StartedOnTime } from '../domain/app/types';
import { DisciplineTechnique, getActiveTechniqueGuides, getDisciplineTechniqueById } from '../domain/discipline/techniques';
import { useAppStore } from '../store/AppStore';
import { getDayInChapter, getTodayLog } from '../store/selectors';
import { colors, radius, spacing, typography } from '../theme';

interface ProgramScreenProps {
  onOpenTechniques: () => void;
  onOpenTechniqueDetails: (techniqueId: string) => void;
}

interface LoopTechniqueItem {
  key: string;
  technique: DisciplineTechnique;
  realIndex: number;
}

const START_OPTIONS: Array<{ key: StartedOnTime; label: string }> = [
  { key: 'on_time', label: 'Вовремя' },
  { key: 'late', label: 'Позже' },
  { key: 'very_late', label: 'Сильно позже' },
];

const OBSTACLE_OPTIONS = ['Телефон', 'Усталость', 'Суета', 'Перфекционизм'];

const CAROUSEL_PEEK = 24;
const CAROUSEL_MIN_RATIO = 0.78;
const CAROUSEL_MAX_RATIO = 0.86;
const CAROUSEL_ITEM_GAP = 12;
const CAROUSEL_CENTER_SCALE = 1.06;
const CAROUSEL_SIDE_SCALE = 0.94;
const LOOP_MULTIPLIER = 80;
const SWIPE_VELOCITY_THRESHOLD = 0.2;

function normalizeModulo(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

function buildLoopData(base: DisciplineTechnique[]): LoopTechniqueItem[] {
  const count = base.length;
  if (!count) {
    return [];
  }

  if (count === 1) {
    const single = base[0]!;
    return [{ key: `${single.id}-0`, technique: single, realIndex: 0 }];
  }

  const total = count * LOOP_MULTIPLIER;
  return Array.from({ length: total }, (_, index) => {
    const realIndex = index % count;
    const technique = base[realIndex]!;
    return {
      key: `${technique.id}-${index}`,
      technique,
      realIndex,
    };
  });
}

export function ProgramScreen({ onOpenTechniques, onOpenTechniqueDetails }: ProgramScreenProps) {
  const { state, completeTodayQuest, setActiveDirection } = useAppStore();
  const { width: screenWidth } = useWindowDimensions();

  const todayLog = useMemo(() => getTodayLog(state), [state]);
  const dayInChapter = useMemo(() => getDayInChapter(state), [state]);
  const activeDirection = state.program.activeDirection || state.program.selectedDirections[0] || 'discipline';

  const selectedTechniques = useMemo(
    () =>
      state.disciplineTechniquesSelected
        .map((id) => getDisciplineTechniqueById(id))
        .filter((item): item is DisciplineTechnique => item !== null),
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

  const [centerIndexReal, setCenterIndexReal] = useState(0);

  const carouselRef = useRef<FlatList<LoopTechniqueItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const isAutoSnapRef = useRef(false);
  const isRecenteringRef = useRef(false);
  const autoSnapReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCount = selectedTechniques.length;
  const hasLoop = selectedCount >= 2;
  const hasSelectedTechniques = selectedCount > 0;

  const loopData = useMemo(() => buildLoopData(selectedTechniques), [selectedTechniques]);
  const selectedSignature = useMemo(() => selectedTechniques.map((item) => item.id).join('|'), [selectedTechniques]);

  const rawItemWidth = Math.round(screenWidth - CAROUSEL_PEEK * 2);
  const minItemWidth = Math.round(screenWidth * CAROUSEL_MIN_RATIO);
  const maxItemWidth = Math.round(screenWidth * CAROUSEL_MAX_RATIO);
  const itemWidth = Math.max(minItemWidth, Math.min(rawItemWidth, maxItemWidth));
  const itemHeight = Math.round(itemWidth * 0.62);
  const carouselViewportHeight = Math.round(itemHeight * 1.18);
  const snapInterval = Math.round(itemWidth + CAROUSEL_ITEM_GAP);
  const sideSpacing = Math.max(0, Math.floor((screenWidth - itemWidth) / 2));

  const startIndex = useMemo(() => {
    if (!hasLoop) {
      return 0;
    }
    const middle = Math.floor(loopData.length / 2);
    return middle - (middle % selectedCount);
  }, [hasLoop, loopData.length, selectedCount]);

  useEffect(() => {
    setQuestDoneDraft(Boolean(todayLog?.questCompleted));
    setStartedOnTime(todayLog?.startedOnTime ?? 'on_time');
    setResistance(todayLog?.resistance ?? 3);
    setObstacles(todayLog?.obstacles ?? []);
    setReflectionText(todayLog?.reflectionText ?? '');
  }, [todayLog]);

  useEffect(() => {
    return () => {
      if (autoSnapReleaseTimerRef.current) {
        clearTimeout(autoSnapReleaseTimerRef.current);
      }
    };
  }, []);

  const markAutoSnap = useCallback((ms = 280) => {
    isAutoSnapRef.current = true;
    if (autoSnapReleaseTimerRef.current) {
      clearTimeout(autoSnapReleaseTimerRef.current);
    }
    autoSnapReleaseTimerRef.current = setTimeout(() => {
      isAutoSnapRef.current = false;
    }, ms);
  }, []);

  const jumpToIndexSilently = useCallback(
    (index: number, animated: boolean) => {
      const safeIndex = Math.max(0, Math.min(loopData.length - 1, index));
      const offset = safeIndex * snapInterval;
      isRecenteringRef.current = true;
      if (!animated) {
        scrollX.setValue(offset);
      }
      carouselRef.current?.scrollToOffset({ offset, animated });
      requestAnimationFrame(() => {
        isRecenteringRef.current = false;
      });
    },
    [loopData.length, scrollX, snapInterval],
  );

  const scrollToIndexAnimated = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(loopData.length - 1, index));
      const offset = safeIndex * snapInterval;
      markAutoSnap();
      carouselRef.current?.scrollToOffset({ offset, animated: true });
    },
    [loopData.length, markAutoSnap, snapInterval],
  );

  useEffect(() => {
    if (!hasSelectedTechniques) {
      return;
    }
    const initialIndex = hasLoop ? startIndex : 0;
    setCenterIndexReal(0);
    requestAnimationFrame(() => {
      jumpToIndexSilently(initialIndex, false);
    });
  }, [hasLoop, hasSelectedTechniques, jumpToIndexSilently, selectedSignature, startIndex]);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasSelectedTechniques || isRecenteringRef.current) {
        return;
      }

      if (isAutoSnapRef.current) {
        return;
      }

      const offsetX = event.nativeEvent.contentOffset.x;
      const currentIndex = offsetX / snapInterval;
      const nearestIndex = Math.round(currentIndex);
      const velocityX = event.nativeEvent.velocity?.x ?? 0;

      if (Math.abs(velocityX) <= SWIPE_VELOCITY_THRESHOLD) {
        return;
      }

      const targetIndex = velocityX > 0 ? nearestIndex - 1 : nearestIndex + 1;
      scrollToIndexAnimated(targetIndex);
    },
    [hasSelectedTechniques, scrollToIndexAnimated, snapInterval],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasSelectedTechniques) {
        setCenterIndexReal(0);
        return;
      }

      const offsetX = event.nativeEvent.contentOffset.x;
      const snappedIndex = Math.round(offsetX / snapInterval);

      if (!hasLoop) {
        isAutoSnapRef.current = false;
        setCenterIndexReal(0);
        return;
      }

      const realIndex = normalizeModulo(snappedIndex, selectedCount);
      setCenterIndexReal((prev) => (prev === realIndex ? prev : realIndex));

      const nearStartEdge = snappedIndex < selectedCount * 2;
      const nearEndEdge = snappedIndex > loopData.length - selectedCount * 2;

      if ((nearStartEdge || nearEndEdge) && !isRecenteringRef.current) {
        const recenteredIndex = startIndex + realIndex;
        if (recenteredIndex !== snappedIndex) {
          requestAnimationFrame(() => {
            jumpToIndexSilently(recenteredIndex, false);
          });
        }
      }
      isAutoSnapRef.current = false;
    },
    [hasLoop, hasSelectedTechniques, jumpToIndexSilently, loopData.length, selectedCount, snapInterval, startIndex],
  );

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

  const hasBeacon = Boolean(state.user.motivationPhrase.trim() || state.user.motivationTags.length || state.user.motivationPhotoUri);
  const shouldShowReflection = questDoneDraft && !todayLog?.questCompleted;
  const hasActiveGuides = activeTechniqueGuides.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pathText}>Этап {Math.min(dayInChapter, state.program.chapterLengthDays)} / {state.program.chapterLengthDays}</Text>

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

      <View style={[styles.techniquesSection, { width: screenWidth }]}>
        <Text style={styles.techniquesTitle}>Ваши техники</Text>

        {hasSelectedTechniques ? (
          <View style={[styles.carouselViewport, { minHeight: carouselViewportHeight }]}>
            <Animated.FlatList
              ref={carouselRef}
              data={loopData}
              keyExtractor={(item) => item.key}
              horizontal
              bounces={false}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              snapToInterval={snapInterval}
              snapToAlignment="center"
              decelerationRate="fast"
              disableIntervalMomentum={false}
              removeClippedSubviews={false}
              initialScrollIndex={hasLoop ? startIndex : 0}
              contentContainerStyle={[styles.carouselContent, { paddingHorizontal: sideSpacing }]}
              getItemLayout={(_, index) => ({
                length: snapInterval,
                offset: snapInterval * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                jumpToIndexSilently(info.index, false);
              }}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumEnd}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                useNativeDriver: true,
              })}
              renderItem={({ item, index }) => {
                const inputRange = [(index - 1) * snapInterval, index * snapInterval, (index + 1) * snapInterval];
                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [CAROUSEL_SIDE_SCALE, CAROUSEL_CENTER_SCALE, CAROUSEL_SIDE_SCALE],
                  extrapolate: 'clamp',
                });
                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.82, 1, 0.82],
                  extrapolate: 'clamp',
                });
                const translateY = scrollX.interpolate({
                  inputRange,
                  outputRange: [8, 0, 8],
                  extrapolate: 'clamp',
                });

                const isActive = state.disciplineTechniquesActive.includes(item.technique.id);

                return (
                  <Animated.View
                    style={[
                      styles.carouselItemWrap,
                      {
                        width: itemWidth,
                        opacity,
                        transform: [{ translateY }, { scale }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.techniqueSlide,
                        { width: itemWidth, minHeight: itemHeight, maxHeight: itemHeight, height: itemHeight },
                        isActive ? styles.techniqueSlideActive : undefined,
                      ]}
                    >
                      <View style={styles.slideTopRow}>
                        <Text style={styles.slideTitle} numberOfLines={2} ellipsizeMode="tail">
                          {item.technique.titleRu}
                        </Text>
                        {isActive ? (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>Активна</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.slideShort} numberOfLines={2} ellipsizeMode="tail">
                        {item.technique.shortRu}
                      </Text>

                      <Pressable onPress={() => onOpenTechniqueDetails(item.technique.id)}>
                        <Text style={styles.detailsLink}>Подробнее</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.carouselItemGap} />}
            />
          </View>
        ) : (
          <View style={[styles.techniquesEmptyWrap, { minHeight: Math.round(carouselViewportHeight * 0.5) }]}>
            <Text style={[styles.emptyLine, styles.techniquesEmptyText]}>Выбери техники, которые тебе подходят.</Text>
          </View>
        )}

        <View style={styles.techniquesFooterRow}>
          <Text style={styles.counterText}>Выбрано: {selectedTechniques.length}</Text>
          <Pressable style={styles.changeButton} onPress={onOpenTechniques}>
            <Text style={styles.changeButtonText}>Изменить</Text>
          </Pressable>
        </View>
      </View>

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
                  Выбери до 3 активных техник - по ним будут подсказки и уведомления.
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
  techniquesSection: {
    alignSelf: 'center',
    overflow: 'visible',
    marginBottom: spacing.md,
  },
  techniquesTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  techniquesEmptyWrap: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  techniquesEmptyText: {
    textAlign: 'center',
  },
  techniquesFooterRow: {
    marginTop: spacing.sm,
    paddingLeft: 32,
    paddingRight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  carouselViewport: {
    width: '100%',
    minHeight: 260,
    paddingVertical: spacing.xs,
    overflow: 'visible',
  },
  carouselContent: {
    alignItems: 'center',
    overflow: 'visible',
  },
  carouselItemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    overflow: 'visible',
  },
  carouselItemGap: {
    width: CAROUSEL_ITEM_GAP,
  },
  techniqueSlide: {
    marginBottom: 0,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'visible',
  },
  techniqueSlideActive: {
    borderColor: 'rgba(124,92,255,0.68)',
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
    marginRight: spacing.xs,
  },
  slideShort: {
    ...typography.body,
    color: colors.text2,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  activeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.58)',
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: colors.primary2,
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
