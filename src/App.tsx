import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlassCard } from './components/ui/GlassCard';
import { PrimaryButton } from './components/ui/PrimaryButton';
import { BackgroundDecor } from './components/ui/BackgroundDecor';
import { Screen } from './components/ui/Screen';
import { getDisciplineTechniqueById } from './domain/discipline/techniques';
import { DisciplineTechniquesIntroScreen } from './screens/DisciplineTechniquesIntroScreen';
import { UserProfile } from './domain/app/types';
import { DisciplineTechniquesScreen } from './screens/DisciplineTechniquesScreen';
import { CharacterScreen } from './screens/CharacterScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ProgramScreen } from './screens/ProgramScreen';
import { TechniqueDetailsScreen } from './screens/TechniqueDetailsScreen';
import { AppStoreProvider, useAppStore } from './store/AppStore';
import { colors, radius, spacing, typography } from './theme';

type TabKey = 'program' | 'progress' | 'character';
type Gender = 'male' | 'female';
type DirectionKey = 'discipline';
type OnboardingStep = 1 | 2 | 3 | 4;
type MotivationReason =
  | 'future_self'
  | 'family'
  | 'goal'
  | 'freedom'
  | 'health'
  | 'self_respect';

type ProgramOverlayRoute =
  | { screen: 'techniques_intro'; firstTime: boolean }
  | { screen: 'techniques'; firstTime: boolean }
  | { screen: 'technique'; techniqueId: string; fromList: boolean; firstTime: boolean };

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'program', label: 'Программа' },
  { key: 'progress', label: 'Прогресс' },
  { key: 'character', label: 'Характер' },
];

const MOTIVATION_OPTIONS: Array<{ key: MotivationReason; label: string }> = [
  { key: 'future_self', label: 'Ради себя в будущем' },
  { key: 'family', label: 'Ради семьи / близких' },
  { key: 'goal', label: 'Ради цели / мечты' },
  { key: 'freedom', label: 'Ради свободы' },
  { key: 'health', label: 'Ради здоровья' },
  { key: 'self_respect', label: 'Ради уважения к себе' },
];

const DIRECTION_OPTIONS: Array<{ key: DirectionKey; label: string; enabled: boolean }> = [
  { key: 'discipline', label: 'Дисциплина', enabled: true },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('program');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { state, isHydrated, completeOnboarding, setHasSeenTechniquesIntro, resetAllData } = useAppStore();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(1);

  const [draftName, setDraftName] = useState('');
  const [draftGender, setDraftGender] = useState<Gender | null>(null);

  const [motivationSelected, setMotivationSelected] = useState<MotivationReason[]>([]);
  const [motivationPhrase, setMotivationPhrase] = useState('');
  const [motivationPhotoUri, setMotivationPhotoUri] = useState('');
  const [motivationHintVisible, setMotivationHintVisible] = useState(false);

  const [directionsSelected, setDirectionsSelected] = useState<DirectionKey[]>([]);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [programOverlayRoute, setProgramOverlayRoute] = useState<ProgramOverlayRoute | null>(null);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  useEffect(() => {
    if (!isHydrated || state.onboardingCompleted) {
      return;
    }

    setDraftName(state.user.name || '');
    setDraftGender(null);
    setMotivationSelected(
      state.user.motivationTags.filter((item): item is MotivationReason =>
        MOTIVATION_OPTIONS.some((option) => option.key === item),
      ),
    );
    setMotivationPhrase(state.user.motivationPhrase || '');
    setMotivationPhotoUri(state.user.motivationPhotoUri || '');
    const selected = state.program.selectedDirections.filter((item): item is DirectionKey => item === 'discipline');
    setDirectionsSelected(selected);
    setMultiSelectEnabled(selected.length > 1);
  }, [isHydrated, state]);

  useEffect(() => {
    if (
      state.onboardingCompleted &&
      !isProfileOpen &&
      activeTab === 'program' &&
      state.program.activeDirection === 'discipline' &&
      !state.hasChosenTechniques &&
      !state.hasSeenTechniquesIntro &&
      !programOverlayRoute
    ) {
      setProgramOverlayRoute({ screen: 'techniques_intro', firstTime: true });
    }
  }, [activeTab, isProfileOpen, programOverlayRoute, state]);

  const trimmedName = draftName.trim();
  const isStepTwoValid = trimmedName.length > 0 && draftGender !== null;
  const hasAnyMotivation =
    motivationSelected.length > 0 || motivationPhrase.trim().length > 0 || motivationPhotoUri.trim().length > 0;
  const canFinishOnboarding = directionsSelected.length > 0;

  const openProfile = () => setIsProfileOpen(true);
  const closeProfile = () => setIsProfileOpen(false);
  const openTechniques = () =>
    setProgramOverlayRoute({ screen: state.hasSeenTechniquesIntro ? 'techniques' : 'techniques_intro', firstTime: false });
  const openTechniqueDetails = (techniqueId: string) =>
    setProgramOverlayRoute({ screen: 'technique', techniqueId, fromList: false, firstTime: false });
  const closeProgramOverlay = () => setProgramOverlayRoute(null);
  const continueTechniquesIntro = () => {
    if (programOverlayRoute?.screen !== 'techniques_intro') {
      return;
    }
    setHasSeenTechniquesIntro(true);
    setProgramOverlayRoute({ screen: 'techniques', firstTime: programOverlayRoute.firstTime });
  };
  const skipTechniquesIntro = () => {
    setHasSeenTechniquesIntro(true);
    closeProgramOverlay();
  };
  const backFromTechniqueDetails = () => {
    if (programOverlayRoute?.screen !== 'technique') {
      return;
    }

    if (programOverlayRoute.fromList) {
      setProgramOverlayRoute({ screen: 'techniques', firstTime: programOverlayRoute.firstTime });
      return;
    }
    setProgramOverlayRoute(null);
  };

  const selectTab = (tab: TabKey) => {
    setActiveTab(tab);
    setIsProfileOpen(false);
    setProgramOverlayRoute(null);
  };

  const goBackOnboarding = () => {
    setOnboardingStep((prev) => (prev > 1 ? ((prev - 1) as OnboardingStep) : 1));
  };

  const goFromWelcome = () => setOnboardingStep(2);

  const goFromIntroProfile = () => {
    if (!isStepTwoValid) {
      return;
    }
    setOnboardingStep(3);
  };

  const goFromMotivation = () => {
    setMotivationHintVisible(!hasAnyMotivation);
    setOnboardingStep(4);
  };

  const finishOnboarding = () => {
    if (!isStepTwoValid || !draftGender || !canFinishOnboarding) {
      return;
    }

    const payload: UserProfile = {
      name: trimmedName,
      gender: draftGender,
      motivationTags: motivationSelected,
      motivationPhrase: motivationPhrase.trim(),
      motivationPhotoUri: motivationPhotoUri.trim(),
    };
    completeOnboarding({
      user: payload,
      program: {
        selectedDirections: directionsSelected,
        activeDirection: directionsSelected[0] ?? '',
        chapterLengthDays: 30,
      },
    });
    setOnboardingStep(1);
    setActiveTab('program');
    setIsProfileOpen(false);
  };

  const resetOnboarding = () => {
    setDraftName('');
    setDraftGender(null);
    setMotivationSelected([]);
    setMotivationPhrase('');
    setMotivationPhotoUri('');
    setMotivationHintVisible(false);
    setDirectionsSelected([]);
    setMultiSelectEnabled(false);
    setOnboardingStep(1);
    setIsProfileOpen(false);
    setProgramOverlayRoute(null);
    resetAllData();
  };

  const toggleMotivation = (item: MotivationReason) => {
    setMotivationHintVisible(false);
    setMotivationSelected((prev) => {
      if (prev.includes(item)) {
        return prev.filter((value) => value !== item);
      }

      if (prev.length >= 3) {
        Alert.alert('Ограничение', 'Можно выбрать до 3 мотивов.');
        return prev;
      }

      return [...prev, item];
    });
  };

  const handleUploadPhoto = () => {
    // TODO: подключить expo-image-picker при необходимости.
    Alert.alert('Загрузка фото', 'Пока не подключено. Здесь будет выбор фото из галереи.');
  };

  const toggleDirection = (direction: DirectionKey) => {
    setDirectionsSelected((prev) => {
      if (!multiSelectEnabled) {
        if (prev.includes(direction)) {
          return [];
        }
        return [direction];
      }

      if (prev.includes(direction)) {
        return prev.filter((item) => item !== direction);
      }

      if (prev.length >= 3) {
        Alert.alert('Лимит выбора', 'Можно выбрать не более 3 направлений.');
        return prev;
      }

      return [...prev, direction];
    });
  };

  const handleMultiToggle = (nextValue: boolean) => {
    if (!nextValue) {
      setMultiSelectEnabled(false);
      setDirectionsSelected((prev) => prev.slice(0, 1));
      return;
    }

    Alert.alert(
      'Выбор нескольких направлений',
      'Если ты возьмешь сразу несколько направлений, фокус будет слабее — прогресс может идти медленнее.\nМы рекомендуем начать с одного направления и закрепить привычку.\n\nХочешь продолжить и выбрать до 3 направлений?',
      [
        {
          text: 'Остаться с одним',
          style: 'cancel',
          onPress: () => setMultiSelectEnabled(false),
        },
        {
          text: 'Да, продолжаю',
          onPress: () => setMultiSelectEnabled(true),
        },
      ],
      { cancelable: true },
    );
  };

  const headerTitle = isProfileOpen
    ? 'Профиль'
    : programOverlayRoute?.screen === 'techniques' || programOverlayRoute?.screen === 'techniques_intro'
      ? 'Техники дисциплины'
      : programOverlayRoute?.screen === 'technique'
        ? getDisciplineTechniqueById(programOverlayRoute.techniqueId)?.titleRu ?? 'Техника'
        : activeTab === 'program'
          ? 'Программа'
          : activeTab === 'progress'
            ? 'Прогресс'
            : 'Характер';
  const canGoBack =
    isProfileOpen ||
    programOverlayRoute?.screen === 'technique' ||
    ((programOverlayRoute?.screen === 'techniques' || programOverlayRoute?.screen === 'techniques_intro') &&
      !programOverlayRoute.firstTime);
  const handleBack = () => {
    if (isProfileOpen) {
      closeProfile();
      return;
    }
    if (programOverlayRoute?.screen === 'technique') {
      backFromTechniqueDetails();
      return;
    }
    if (
      (programOverlayRoute?.screen === 'techniques' || programOverlayRoute?.screen === 'techniques_intro') &&
      !programOverlayRoute.firstTime
    ) {
      closeProgramOverlay();
    }
  };

  if (!isHydrated) {
    return (
      <Screen>
        <View style={styles.contentArea}>
          <BackgroundDecor style={StyleSheet.absoluteFillObject} />
          <View style={[styles.contentAboveDecor, styles.loadingWrap]}>
            <Text style={styles.loadingText}>Загрузка...</Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (!state.onboardingCompleted) {
    return (
      <Screen>
        <View style={styles.contentArea}>
          <BackgroundDecor style={StyleSheet.absoluteFillObject} />
          <View style={[styles.contentAboveDecor, styles.onboardingWrap, { paddingTop: topInset + spacing.lg }]}>
            <ScrollView contentContainerStyle={styles.onboardingBody} showsVerticalScrollIndicator={false}>
            {onboardingStep === 1 ? (
              <>
                <Text style={styles.onboardingTitle}>Добро пожаловать</Text>
                <Text style={styles.onboardingText}>Это приложение — не про идеальность.</Text>
                <Text style={styles.onboardingText}>Это про то, чтобы каждый день становиться чуть сильнее.</Text>
                <Text style={styles.onboardingText}>
                  Ты выберешь направление, которое хочешь укрепить, и начнешь путь маленькими шагами.
                </Text>
                <Text style={styles.onboardingText}>Когда будет сложно — мы будем возвращать тебя к твоему «зачем».</Text>
                <Text style={styles.onboardingText}>Когда получится — ты увидишь, как меняется твой характер.</Text>
                <Text style={styles.onboardingPromise}>2-5 минут в день достаточно, чтобы начать меняться.</Text>
              </>
            ) : null}

            {onboardingStep === 2 ? (
              <>
                <Text style={styles.onboardingTitle}>Знакомство</Text>
                <Text style={styles.onboardingText}>
                  Введи имя и выбери пол — так приложение будет обращаться к тебе правильно.
                </Text>

                <GlassCard>
                  <TextInput
                    style={styles.input}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Ваше имя"
                    placeholderTextColor={colors.text3}
                  />

                  <View style={styles.genderRow}>
                    <Pressable
                      style={[styles.choiceChip, draftGender === 'male' ? styles.choiceChipActive : null]}
                      onPress={() => setDraftGender('male')}
                    >
                      <Text style={[styles.choiceChipText, draftGender === 'male' ? styles.choiceChipTextActive : null]}>
                        Мужчина
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.choiceChip, draftGender === 'female' ? styles.choiceChipActive : null]}
                      onPress={() => setDraftGender('female')}
                    >
                      <Text style={[styles.choiceChipText, draftGender === 'female' ? styles.choiceChipTextActive : null]}>
                        Женщина
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              </>
            ) : null}

            {onboardingStep === 3 ? (
              <>
                <Text style={styles.onboardingTitle}>Точка опоры</Text>
                <Text style={styles.onboardingText}>Когда станет трудно — это будет возвращать тебя к курсу.</Text>

                <GlassCard>
                  <View style={styles.photoPlaceholderWrap}>
                    {motivationPhotoUri ? (
                      <Text style={styles.photoReadyText}>Фото выбрано</Text>
                    ) : (
                      <Text style={styles.photoPlaceholderText}>Фото-якорь</Text>
                    )}
                  </View>

                  <PrimaryButton label="Загрузить фото" variant="secondary" onPress={handleUploadPhoto} />

                  <Text style={styles.photoHint}>Можно фото человека, цели или любого символа.</Text>

                  <Text style={styles.fieldLabel}>Мотивация (1-3)</Text>
                  <View style={styles.chipsWrap}>
                    {MOTIVATION_OPTIONS.map((item) => {
                      const active = motivationSelected.includes(item.key);
                      return (
                        <Pressable
                          key={item.key}
                          style={[styles.motivationChip, active ? styles.motivationChipActive : null]}
                          onPress={() => toggleMotivation(item.key)}
                        >
                          <Text style={[styles.motivationChipText, active ? styles.motivationChipTextActive : null]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Одна фраза</Text>
                  <TextInput
                    style={styles.input}
                    value={motivationPhrase}
                    onChangeText={(value) => {
                      setMotivationHintVisible(false);
                      setMotivationPhrase(value);
                    }}
                    placeholder="Я делаю это ради ______"
                    placeholderTextColor={colors.text3}
                  />

                  {motivationHintVisible ? (
                    <Text style={styles.softHint}>Можно продолжить без заполнения, но лучше добавить точку опоры.</Text>
                  ) : null}
                </GlassCard>
              </>
            ) : null}

            {onboardingStep === 4 ? (
              <>
                <Text style={styles.onboardingTitle}>Первый фокус</Text>
                <Text style={styles.onboardingText}>
                  Начни с одного направления. Лучший результат дает один фокус. Но выбор за тобой.
                </Text>

                <GlassCard>
                  <View style={styles.directionListWrap}>
                    {DIRECTION_OPTIONS.map((item) => {
                      const checked = directionsSelected.includes(item.key);
                      return (
                        <Pressable
                          key={item.key}
                          style={[styles.directionOptionRow, checked ? styles.directionOptionRowActive : null]}
                          onPress={() => toggleDirection(item.key)}
                          disabled={!item.enabled}
                        >
                          <View style={[styles.checkbox, checked ? styles.checkboxActive : null]}>
                            {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                          </View>
                          <Text style={styles.directionOptionText}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.multiToggleRow}>
                    <Switch value={multiSelectEnabled} onValueChange={handleMultiToggle} />
                    <Text style={styles.multiToggleText}>Хочу выбрать больше одного направления</Text>
                  </View>

                  {multiSelectEnabled ? <Text style={styles.counterHint}>Выбрано: {directionsSelected.length}/3</Text> : null}
                  {!canFinishOnboarding ? (
                    <Text style={styles.softHint}>Выбери хотя бы одно направление для старта.</Text>
                  ) : null}
                </GlassCard>
              </>
            ) : null}
            </ScrollView>

            <View style={styles.onboardingActions}>
              {onboardingStep > 1 ? <PrimaryButton label="Назад" variant="secondary" onPress={goBackOnboarding} /> : null}

              {onboardingStep === 1 ? <PrimaryButton label="Начать путь" onPress={goFromWelcome} /> : null}

              {onboardingStep === 2 ? (
                <PrimaryButton label="Далее" onPress={goFromIntroProfile} disabled={!isStepTwoValid} />
              ) : null}

              {onboardingStep === 3 ? <PrimaryButton label="Сохранить" onPress={goFromMotivation} /> : null}

              {onboardingStep === 4 ? (
                <PrimaryButton label="Начать" onPress={finishOnboarding} disabled={!canFinishOnboarding} />
              ) : null}
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: topInset, height: 64 + topInset }]}> 
        <View style={styles.headerSideLeft}>
          {canGoBack ? (
            <Pressable style={styles.headerButton} onPress={handleBack}>
              <Text style={styles.headerButtonText}>Назад</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>

        <View style={styles.headerSideRight}>
          {!isProfileOpen && !programOverlayRoute ? (
            <Pressable style={styles.headerButton} onPress={openProfile}>
              <Text style={styles.headerButtonText}>Профиль</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.contentArea}>
        <BackgroundDecor style={StyleSheet.absoluteFillObject} />
        <View style={styles.contentAboveDecor}>
          {isProfileOpen ? (
            <View style={[styles.screen, styles.profileScreen]}>
              <GlassCard>
                <Text style={styles.profileTitle}>Профиль</Text>
                <Text style={styles.profileText}>{state.user.name ? `Пользователь: ${state.user.name}` : 'Профиль пользователя'}</Text>
                <Pressable style={styles.resetButton} onPress={resetOnboarding}>
                  <Text style={styles.resetButtonText}>Сбросить онбординг</Text>
                </Pressable>
              </GlassCard>
            </View>
          ) : programOverlayRoute?.screen === 'techniques_intro' ? (
            <DisciplineTechniquesIntroScreen
              isFirstSetup={programOverlayRoute.firstTime}
              onContinue={continueTechniquesIntro}
              onSkip={skipTechniquesIntro}
            />
          ) : programOverlayRoute?.screen === 'techniques' ? (
            <DisciplineTechniquesScreen
              isFirstSetup={programOverlayRoute.firstTime}
              onDone={closeProgramOverlay}
              onOpenDetails={(techniqueId) =>
                setProgramOverlayRoute({
                  screen: 'technique',
                  techniqueId,
                  fromList: true,
                  firstTime: programOverlayRoute.firstTime,
                })
              }
            />
          ) : programOverlayRoute?.screen === 'technique' ? (
            <TechniqueDetailsScreen techniqueId={programOverlayRoute.techniqueId} onBack={backFromTechniqueDetails} />
          ) : activeTab === 'program' ? (
            <ProgramScreen onOpenTechniques={openTechniques} onOpenTechniqueDetails={openTechniqueDetails} />
          ) : activeTab === 'progress' ? (
            <ProgressScreen onOpenProgram={() => selectTab('program')} />
          ) : (
            <CharacterScreen onOpenProgram={() => selectTab('program')} />
          )}
        </View>
      </View>

      {!isProfileOpen && !programOverlayRoute ? (
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
                onPress={() => selectTab(tab.key)}
              >
                <Text style={[styles.tabButtonText, isActive ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <AppContent />
    </AppStoreProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text2,
  },
  contentArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.bg0,
  },
  contentAboveDecor: {
    flex: 1,
    zIndex: 1,
  },
  onboardingWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  onboardingBody: {
    paddingBottom: spacing.md,
  },
  onboardingTitle: {
    ...typography.title,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  onboardingText: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  onboardingPromise: {
    ...typography.body,
    color: colors.primary2,
    marginTop: spacing.sm,
    fontWeight: '700',
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
    marginBottom: spacing.md,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    backgroundColor: 'transparent',
  },
  choiceChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.22)',
  },
  choiceChipText: {
    color: colors.text3,
    fontWeight: '600',
  },
  choiceChipTextActive: {
    color: colors.text,
  },
  photoPlaceholderWrap: {
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  photoPlaceholderText: {
    color: colors.text3,
    fontWeight: '600',
  },
  photoReadyText: {
    color: colors.text,
    fontWeight: '700',
  },
  photoHint: {
    ...typography.caption,
    color: colors.text3,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  motivationChip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  motivationChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  motivationChipText: {
    color: colors.text3,
    fontWeight: '600',
    fontSize: 12,
  },
  motivationChipTextActive: {
    color: colors.text,
  },
  softHint: {
    ...typography.caption,
    color: colors.primary2,
  },
  directionListWrap: {
    marginBottom: spacing.md,
  },
  directionOptionRow: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  directionOptionRowActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.text3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxTick: {
    color: colors.text,
    fontWeight: '800',
    marginTop: -1,
  },
  directionOptionText: {
    color: colors.text,
    fontWeight: '700',
  },
  multiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  multiToggleText: {
    flex: 1,
    color: colors.text2,
    lineHeight: 20,
  },
  counterHint: {
    color: colors.primary2,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg0,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerSideLeft: {
    width: 100,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 17,
  },
  headerSideRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  headerButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  profileScreen: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  profileTitle: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  profileText: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  resetButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,92,122,0.15)',
  },
  resetButtonText: {
    color: colors.danger,
    fontWeight: '700',
  },
  tabBar: {
    height: 72,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg0,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    marginHorizontal: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  tabButtonText: {
    color: colors.text3,
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});

