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
    return 'Сделай маленький полезный шаг прямо сейчас.';
  }

  const goal = goals[Math.floor(Math.random() * goals.length)];
  const template = GOAL_TEMPLATES.find((t) => t.id === goal?.category);
  const defaultText = goal?.customAction || 'Выбери полезное действие на этот час.';

  if (!template || template.reminders.length === 0) {
    return defaultText;
  }

  return template.reminders[Math.floor(Math.random() * template.reminders.length)] ?? defaultText;
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
      const ask = await Notifications.requestPermissionsAsync();
      if (!ask.granted) {
        return;
      }
    }

    const slots = Math.max(1, settings.timesPerDay);
    const interval = Math.max(1, Math.floor((settings.endHour - settings.startHour) / slots));

    for (let i = 0; i < slots; i += 1) {
      const hour = Math.min(23, settings.startHour + i * interval);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Character+ напоминание',
          body: randomReminder(goals),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
    }
  }, []);

  return { setupNotifications };
}
