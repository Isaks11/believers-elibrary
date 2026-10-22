/**
 * Structured Bible & Devotional Reading Plans, Personal Spiritual Goals,
 * and Time-Zone-Aware Daily Reminder Preferences (Phase 2).
 */

export interface ReadingPlanDay {
  dayNumber: number;
  title: string;
  scriptureRef: string;
  book: string;
  chapter: number;
  applicationPrompt: string;
}

export interface ReadingPlan {
  id: string;
  title: string;
  subtitle: string;
  category: 'Peace' | 'Purpose' | 'Gospel' | 'Prayer';
  days: ReadingPlanDay[];
}

export const READING_PLANS: ReadingPlan[] = [
  {
    id: 'plan-peace-7',
    title: '7 Days of Peace Over Anxiety',
    subtitle: 'Anchor your heart in God’s promises when life feels overwhelming.',
    category: 'Peace',
    days: [
      { dayNumber: 1, title: 'The Shepherd’s Care', scriptureRef: 'Psalms 23', book: 'Psalms', chapter: 23, applicationPrompt: 'Name one worry you are carrying today and consciously hand it to the Good Shepherd in prayer.' },
      { dayNumber: 2, title: 'Guarded by God’s Peace', scriptureRef: 'Philippians 4', book: 'Philippians', chapter: 4, applicationPrompt: 'Replace one anxious thought today with a specific prayer of thanksgiving.' },
      { dayNumber: 3, title: 'Dwelling in the Secret Place', scriptureRef: 'Psalms 91', book: 'Psalms', chapter: 91, applicationPrompt: 'Set aside 10 quiet minutes today away from screens to rest in God’s presence.' },
      { dayNumber: 4, title: 'Renewed Strength for the Weary', scriptureRef: 'Isaiah 40', book: 'Isaiah', chapter: 40, applicationPrompt: 'Where do you feel depleted? Ask the Lord for strength to wait upon Him today.' },
      { dayNumber: 5, title: 'Seek First the Kingdom', scriptureRef: 'Matthew 6', book: 'Matthew', chapter: 6, applicationPrompt: 'Put God first in the very first decision of your morning.' },
      { dayNumber: 6, title: 'No Separation from Christ’s Love', scriptureRef: 'Romans 8', book: 'Romans', chapter: 8, applicationPrompt: 'Remind yourself aloud that nothing today can separate you from the love of God in Christ Jesus.' },
      { dayNumber: 7, title: 'Peace Jesus Leaves With Us', scriptureRef: 'John 14', book: 'John', chapter: 14, applicationPrompt: 'Share a word of peace and encouragement with someone else who is stressed this week.' },
    ],
  },
  {
    id: 'plan-purpose-7',
    title: '7 Days of Wisdom & Direction',
    subtitle: 'Biblical wisdom for discerning God’s calling and daily decisions.',
    category: 'Purpose',
    days: [
      { dayNumber: 1, title: 'Trusting the Lord Wholeheartedly', scriptureRef: 'Proverbs 3', book: 'Proverbs', chapter: 3, applicationPrompt: 'Acknowledge God before your next major decision instead of relying only on your own calculation.' },
      { dayNumber: 2, title: 'Created for Good Works', scriptureRef: 'Ephesians 2', book: 'Ephesians', chapter: 2, applicationPrompt: 'Identify one person you can serve practically today as part of God’s workmanship.' },
      { dayNumber: 3, title: 'Asking God for Wisdom', scriptureRef: 'James 1', book: 'James', chapter: 1, applicationPrompt: 'Pray specifically for wisdom in one area where you feel uncertain.' },
      { dayNumber: 4, title: 'Living as a Living Sacrifice', scriptureRef: 'Romans 12', book: 'Romans', chapter: 12, applicationPrompt: 'How can you renew your mind with Scripture today rather than conforming to the world?' },
      { dayNumber: 5, title: 'The Light of the Word', scriptureRef: 'Psalms 119', book: 'Psalms', chapter: 119, applicationPrompt: 'Memorize one short verse from today’s reading to carry with you.' },
      { dayNumber: 6, title: 'Walking Worthy of the Calling', scriptureRef: 'Ephesians 4', book: 'Ephesians', chapter: 4, applicationPrompt: 'Practice humility, gentleness, and patience in a challenging conversation today.' },
      { dayNumber: 7, title: 'Pressing Toward the Goal', scriptureRef: 'Philippians 3', book: 'Philippians', chapter: 3, applicationPrompt: 'Let go of one past regret and fix your eyes forward on Christ’s calling.' },
    ],
  },
  {
    id: 'plan-john-7',
    title: '7 Days in the Gospel of John',
    subtitle: 'Encounter Jesus the Word, the Light, the Good Shepherd, and the Risen Lord.',
    category: 'Gospel',
    days: [
      { dayNumber: 1, title: 'The Word Made Flesh', scriptureRef: 'John 1', book: 'John', chapter: 1, applicationPrompt: 'Reflect on what it means that the Creator of the universe stepped into human history for you.' },
      { dayNumber: 2, title: 'Born Again by the Spirit', scriptureRef: 'John 3', book: 'John', chapter: 3, applicationPrompt: 'Thank God for the gift of eternal life through faith in His Son.' },
      { dayNumber: 3, title: 'Living Water for the Thirsty Soul', scriptureRef: 'John 4', book: 'John', chapter: 4, applicationPrompt: 'Bring your deepest spiritual thirst to Jesus in honest worship today.' },
      { dayNumber: 4, title: 'The Good Shepherd', scriptureRef: 'John 10', book: 'John', chapter: 10, applicationPrompt: 'Practice listening to the Shepherd’s voice through quiet meditation on His words.' },
      { dayNumber: 5, title: 'Abiding in the True Vine', scriptureRef: 'John 15', book: 'John', chapter: 15, applicationPrompt: 'Stay connected to Christ throughout your workday with brief moments of prayer.' },
      { dayNumber: 6, title: 'The Cross and Redemption', scriptureRef: 'John 19', book: 'John', chapter: 19, applicationPrompt: 'Meditate on Jesus’ words "It is finished" and rest in His completed work.' },
      { dayNumber: 7, title: 'The Risen Savior', scriptureRef: 'John 20', book: 'John', chapter: 20, applicationPrompt: 'Live with resurrection hope today, knowing Christ has conquered death.' },
    ],
  },
];

// Map of planId -> array of completed dayNumbers (1-based) and ISO completion dates
export type PlanProgressRecord = {
  completedDays: Record<number, string>; // dayNumber -> YYYY-MM-DD
  startedAt: string;
};

const PLAN_PROGRESS_KEY = 'reading_plans_progress_v1';
const SPIRITUAL_GOALS_KEY = 'spiritual_goals_v1';
const REMINDER_PREFS_KEY = 'daily_reminder_prefs_v1';

export function getReadingPlansProgress(): Record<string, PlanProgressRecord> {
  try {
    const raw = localStorage.getItem(PLAN_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function toggleReadingPlanDay(planId: string, dayNumber: number): Record<string, PlanProgressRecord> {
  const all = getReadingPlansProgress();
  const record: PlanProgressRecord = all[planId] || {
    completedDays: {},
    startedAt: new Date().toISOString(),
  };

  if (record.completedDays[dayNumber]) {
    delete record.completedDays[dayNumber];
  } else {
    record.completedDays[dayNumber] = new Date().toISOString().slice(0, 10);
  }

  all[planId] = record;
  try {
    localStorage.setItem(PLAN_PROGRESS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
  return all;
}

export interface SpiritualGoals {
  focusTheme: string;
  weeklyDevotionalsTarget: number;
  weeklyChaptersTarget: number;
  weeklyPrayersTarget: number;
}

const DEFAULT_GOALS: SpiritualGoals = {
  focusTheme: 'Walking daily in Scripture & prayer',
  weeklyDevotionalsTarget: 5,
  weeklyChaptersTarget: 7,
  weeklyPrayersTarget: 3,
};

export function getSpiritualGoals(): SpiritualGoals {
  try {
    const raw = localStorage.getItem(SPIRITUAL_GOALS_KEY);
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw);
    return {
      focusTheme: String(parsed.focusTheme || DEFAULT_GOALS.focusTheme),
      weeklyDevotionalsTarget: Number(parsed.weeklyDevotionalsTarget) || DEFAULT_GOALS.weeklyDevotionalsTarget,
      weeklyChaptersTarget: Number(parsed.weeklyChaptersTarget) || DEFAULT_GOALS.weeklyChaptersTarget,
      weeklyPrayersTarget: Number(parsed.weeklyPrayersTarget) || DEFAULT_GOALS.weeklyPrayersTarget,
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveSpiritualGoals(goals: SpiritualGoals): SpiritualGoals {
  try {
    localStorage.setItem(SPIRITUAL_GOALS_KEY, JSON.stringify(goals));
  } catch { /* ignore */ }
  return goals;
}

export interface DailyReminderPrefs {
  enabled: boolean;
  time: string; // HH:MM (24h)
  timezone: string;
  lastNotifiedDate?: string;
}

export function getDailyReminderPrefs(): DailyReminderPrefs {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    const raw = localStorage.getItem(REMINDER_PREFS_KEY);
    if (!raw) return { enabled: false, time: '07:00', timezone: tz };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      time: String(parsed.time || '07:00'),
      timezone: String(parsed.timezone || tz),
      lastNotifiedDate: parsed.lastNotifiedDate,
    };
  } catch {
    return { enabled: false, time: '07:00', timezone: tz };
  }
}

export function saveDailyReminderPrefs(prefs: DailyReminderPrefs): DailyReminderPrefs {
  try {
    localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
  return prefs;
}

export async function requestNotificationPermissionAndTest(title: string, body: string): Promise<boolean> {
  if (!('Notification' in window)) return false;
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm === 'granted') {
    try {
      new Notification(title, { body });
    } catch { /* mobile browsers may require service worker */ }
    return true;
  }
  return false;
}
