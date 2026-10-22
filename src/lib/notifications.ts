/**
 * Daily Reminder Notification System (Phase 3 — Stage 4)
 *
 * Client-side scheduling: the reminder fires from an interval plus app
 * lifecycle events (visibilitychange / focus / online), so it triggers as soon
 * as the app is opened after the scheduled time (at most ~60s late while the
 * app stays open). Truly silent background delivery while the app is fully
 * closed requires a Web Push server + push subscription storage — out of scope.
 *
 * Reminder preferences (enabled / time / timezone / lastNotifiedDate) live in
 * the shared `daily_reminder_prefs_v1` store owned by `@/data/readingPlans`.
 */

import { toast } from 'sonner'
import { getDailyReminderPrefs, saveDailyReminderPrefs } from '@/data/readingPlans'

const REMINDER_TITLE = 'Daily Word & Prayer'
const REMINDER_TAG = 'daily-reminder'
const REMINDER_MESSAGES = [
  '“Your word is a lamp to my feet and a light to my path.” — Psalm 119:105',
  '“Cast all your anxiety on Him, because He cares for you.” — 1 Peter 5:7',
  'Time for prayer & today’s Word — may the Lord strengthen and guide you today.',
  '“Be still, and know that I am God.” — Psalms 46:10',
]

/** Safe even when the browser has no Notification API (SSR-free guard). */
export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'default'
  return Notification.permission
}

/** Requests permission; returns 'default' gracefully on unsupported browsers. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'default'
  try {
    if (Notification.permission !== 'default') return Notification.permission
    return await Notification.requestPermission()
  } catch {
    return 'default'
  }
}

/** True when running as an installed PWA (iOS Safari `navigator.standalone` or `display-mode: standalone`). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (typeof nav.standalone === 'boolean') return nav.standalone // iOS Safari
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

/**
 * Shows a local notification: prefers the service worker registration (required
 * on mobile / iOS PWAs), falls back to the Notification constructor, and finally
 * to a sonner toast so the user always gets in-app feedback.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  opts?: { tag?: string; url?: string }
): Promise<void> {
  const swOptions = {
    body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: { url: opts?.url ?? '/' },
    tag: opts?.tag,
  }
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, swOptions)
        return
      }
    }
  } catch { /* fall through to constructor / toast fallbacks */ }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.svg' })
      return
    }
  } catch { /* fall through to toast fallback */ }
  toast.info(`${title}: ${body}`)
}

/** Formats a Date as YYYY-MM-DD in the given IANA timezone (falls back to UTC). */
function timezoneIsoDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Formats a Date as zero-padded HH:MM (24h) in the given IANA timezone. */
function timezoneTimeString(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date)
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
}

/**
 * Fires the daily reminder if it is due: prefs enabled, permission granted,
 * the stored time (in the stored timezone) has been reached today, and today's
 * ISO date has not already been delivered (`lastNotifiedDate` de-dup guard).
 * Returns true when a notification was fired.
 */
export function checkAndFireDailyReminder(now: Date = new Date()): boolean {
  const prefs = getDailyReminderPrefs()
  if (!prefs.enabled) return false
  if (getNotificationPermission() !== 'granted') return false

  const todayISO = timezoneIsoDate(now, prefs.timezone)
  if (prefs.lastNotifiedDate === todayISO) return false

  const scheduledTime = /^\d{2}:\d{2}$/.test(prefs.time) ? prefs.time : '07:00'
  const currentTime = timezoneTimeString(now, prefs.timezone)
  if (currentTime < scheduledTime) return false // scheduled time not reached yet

  const message = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)]
  void showLocalNotification(REMINDER_TITLE, message, { tag: REMINDER_TAG, url: '/devotional' })
  saveDailyReminderPrefs({ ...prefs, lastNotifiedDate: todayISO })
  return true
}

let schedulerActive = false

/**
 * Starts the reminder scheduler (idempotent — repeated calls return a no-op).
 * Checks immediately, then every 60s and on visibilitychange/focus/online.
 * Returns a cleanup function that stops the interval and event listeners.
 */
export function initDailyReminderScheduler(): () => void {
  if (schedulerActive) return () => { /* already running */ }
  schedulerActive = true

  const check = () => {
    try {
      checkAndFireDailyReminder()
    } catch { /* never let the scheduler break the app */ }
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') check()
  }

  check()
  const intervalId = window.setInterval(check, 60_000)
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    schedulerActive = false
    window.clearInterval(intervalId)
    window.removeEventListener('focus', check)
    window.removeEventListener('online', check)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
