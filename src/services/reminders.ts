import type { ReminderSettings } from '../types'

export type NotificationSupport = NotificationPermission | 'unsupported'

export const defaultReminderSettings: ReminderSettings = {
  enabled: false,
  waterEnabled: true,
  mealEnabled: true,
  waterIntervalMinutes: 120,
  mealTimes: ['08:30', '11:30', '14:30', '20:00'],
}

export function getNotificationPermission(): NotificationSupport {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.requestPermission()
}

export async function sendReminderNotification(title: string, body: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false

  const options: NotificationOptions = {
    body,
    icon: `${import.meta.env.BASE_URL}icons/tawazon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/tawazon-192.png`,
    tag,
    data: { url: import.meta.env.BASE_URL },
  }

  try {
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      : undefined
    if (registration) await registration.showNotification(title, options)
    else new Notification(title, options)
    return true
  } catch {
    return false
  }
}
