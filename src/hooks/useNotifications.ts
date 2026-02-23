import { useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { GOAL_TEMPLATES } from '../constants/templates';
import { ReminderSettings, UserGoal } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function randomReminder(goals: UserGoal[]): string {
  if (goals.length === 0) {
    return 'Сделай небольшой полезный шаг прямо сейчас.';
  }

  const goal = goals[Math.floor(Math.random() * goals.length)];
  const template = GOAL_TEMPLATES.find((item) => item.id === goal?.category);
  const fallback = goal?.customAction || 'Выбери полезное действие на этот час.';

  if (!template || template.reminders.length === 0) {
    return fallback;
  }

  return template.reminders[Math.floor(Math.random() * template.reminders.length)] ?? fallback;
}

function normalizeHour(value: number): number {
  return Math.max(0, Math.min(23, Math.floor(value)));
}

export function useNotifications() {
  const setupNotifications = useCallback(async (settings: ReminderSettings, goals: UserGoal[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!settings.enabled || goals.length === 0) {
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    const granted = permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted) {
      const request = await Notifications.requestPermissionsAsync();
      if (!request.granted) {
        return;
      }
    }

    const slots = Math.max(1, Math.min(8, settings.timesPerDay));
    const startHour = normalizeHour(settings.startHour);
    const endHour = normalizeHour(settings.endHour);

    if (endHour <= startHour) {
      return;
    }

    const totalMinutes = (endHour - startHour) * 60;
    const stepMinutes = Math.max(1, Math.floor(totalMinutes / slots));
    const usedTimes = new Set<string>();

    for (let i = 0; i < slots; i += 1) {
      const offset = i * stepMinutes;
      const hour = Math.min(23, startHour + Math.floor(offset / 60));
      const minute = Math.min(59, offset % 60);
      const triggerKey = `${hour}:${minute}`;

      if (usedTimes.has(triggerKey)) {
        continue;
      }
      usedTimes.add(triggerKey);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Character+ напоминание',
          body: randomReminder(goals),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    }
  }, []);

  return { setupNotifications };
}
