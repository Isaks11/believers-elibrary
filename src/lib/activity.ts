/**
 * Derived user activity & data backup — everything here is computed from actual
 * recorded actions (completed devotionals, journal entries, personal prayers,
 * mood logs, bookmarks, and reading progress). Never seed or hard-code these numbers.
 */
import {
  getCompletedDevotionalMap,
  saveCompletedDevotionalMap,
  getBookmarkedDevotionalIds,
  saveBookmarkedDevotionalIds,
  getFavoriteHymnIds,
  saveFavoriteHymnIds,
} from '@/data/mockDevotionalHymnData';
import {
  getJournalEntries,
  saveJournalEntries,
  getPersonalPrayers,
  savePersonalPrayers,
  getMoodLogs,
  saveMoodLogs,
  localDateKey,
} from '@/data/journalData';
import {
  getUserStats,
  saveUserStats,
  getLibraryProgressMap,
  getPrayerAlerts,
  getPrayerInteractions,
  savePrayerInteractions,
} from '@/data/mockFaithData';
import { getReadingPlansProgress } from '@/data/readingPlans';

/** All local dates (YYYY-MM-DD) on which the user actually did something. */
export function getActivityDates(): Set<string> {
  const dates = new Set<string>();

  try {
    const completedMap = getCompletedDevotionalMap();
    Object.values(completedMap).forEach((dateStr) => {
      if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        dates.add(dateStr.slice(0, 10));
      }
    });
  } catch {
    /* devotional store unavailable */
  }

  try {
    const plans = getReadingPlansProgress();
    Object.values(plans).forEach((rec) => {
      Object.values(rec.completedDays || {}).forEach((dateStr) => {
        if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          dates.add(dateStr.slice(0, 10));
        }
      });
    });
  } catch {
    /* reading plans unavailable */
  }

  try {
    getJournalEntries().forEach((e) => dates.add(e.createdAt.slice(0, 10)));
  } catch {
    /* journal store unavailable */
  }

  try {
    getPersonalPrayers().forEach((p) => dates.add(p.createdAt.slice(0, 10)));
  } catch {
    /* prayer store unavailable */
  }

  try {
    Object.keys(getMoodLogs()).forEach((k) => dates.add(k));
  } catch {
    /* mood store unavailable */
  }

  return dates;
}

/**
 * Consecutive-day streak ending today (or yesterday, so the streak isn't
 * reported as broken before the user has had a chance to act today).
 */
export function computeStreak(): number {
  const dates = getActivityDates();
  const cursor = new Date();

  if (!dates.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(localDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (dates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type DayActivity = { key: string; label: string; count: number };

/** Activity counts for the last 7 days, oldest first, with weekday labels. */
export function last7DayActivity(): DayActivity[] {
  const dates = getActivityDates();
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const days: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    days.push({ key, label: labels[d.getDay()], count: dates.has(key) ? 1 : 0 });
  }
  return days;
}

export function activeDaysThisWeek(): { active: number; total: number } {
  const days = last7DayActivity();
  return { active: days.filter((d) => d.count > 0).length, total: days.length };
}

export function countCompletedDevotionals(): number {
  try {
    return Object.keys(getCompletedDevotionalMap()).length;
  } catch {
    return 0;
  }
}

export function countJournalEntries(): number {
  try {
    return getJournalEntries().length;
  } catch {
    return 0;
  }
}

export function countAllBookmarks(): number {
  try {
    const libAndNews = getUserStats().bookmarks.length;
    const devBookmarks = getBookmarkedDevotionalIds().length;
    const hymnFavs = getFavoriteHymnIds().length;
    let bibleBookmarks = 0;
    try {
      const raw = localStorage.getItem('bible_bookmarks');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) bibleBookmarks = parsed.length;
    } catch { /* ignore */ }
    return libAndNews + devBookmarks + hymnFavs + bibleBookmarks;
  } catch {
    return 0;
  }
}

export function countReadingHistoryEntries(): number {
  try {
    const devDone = countCompletedDevotionals();
    const libOpened = Object.keys(getLibraryProgressMap()).length;
    let bibleHistory = 0;
    try {
      const raw = localStorage.getItem('bible_history');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) bibleHistory = parsed.length;
    } catch { /* ignore */ }
    return devDone + libOpened + bibleHistory;
  } catch {
    return 0;
  }
}

export function countTotalPrayed(): number {
  try {
    const alertPrayed = getPrayerAlerts().filter((a) => a.userPrayed).length;
    const personalPrayers = getPersonalPrayers().length;
    return alertPrayed + personalPrayers;
  } catch {
    return 0;
  }
}

export function countTotalAnsweredPrayers(): number {
  try {
    const alertAnswered = getPrayerAlerts().filter((a) => a.status === 'answered' && a.userPrayed).length;
    const personalAnswered = getPersonalPrayers().filter((p) => p.status === 'answered').length;
    return alertAnswered + personalAnswered;
  } catch {
    return 0;
  }
}

export function countEarnedAchievements(): number {
  const streak = computeStreak();
  const prayed = countTotalPrayed();
  const devDone = countCompletedDevotionals();
  const wroteAtNight = getJournalEntries().some((e) => {
    const h = new Date(e.createdAt).getHours();
    return h >= 22 || h < 5;
  });
  let count = 0;
  if (streak >= 7) count += 1;
  if (prayed >= 1) count += 1;
  if (devDone >= 5) count += 1;
  if (wroteAtNight) count += 1;
  if (prayed >= 3) count += 1;
  return count;
}

export interface PersonalDataBackup {
  version: number;
  exportedAt: string;
  journalEntries: ReturnType<typeof getJournalEntries>;
  personalPrayers: ReturnType<typeof getPersonalPrayers>;
  moodLogs: ReturnType<typeof getMoodLogs>;
  completedDevotionals: ReturnType<typeof getCompletedDevotionalMap>;
  bookmarkedDevotionals: ReturnType<typeof getBookmarkedDevotionalIds>;
  favoriteHymns: ReturnType<typeof getFavoriteHymnIds>;
  userStats: ReturnType<typeof getUserStats>;
  libraryProgress: ReturnType<typeof getLibraryProgressMap>;
  prayerInteractions: ReturnType<typeof getPrayerInteractions>;
  bibleBookmarks: string[];
  bibleHistory: string[];
}

export function exportAllUserData(): string {
  let bibleBookmarks: string[] = [];
  let bibleHistory: string[] = [];
  try {
    bibleBookmarks = JSON.parse(localStorage.getItem('bible_bookmarks') || '[]');
    bibleHistory = JSON.parse(localStorage.getItem('bible_history') || '[]');
  } catch { /* ignore */ }

  const payload: PersonalDataBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    journalEntries: getJournalEntries(),
    personalPrayers: getPersonalPrayers(),
    moodLogs: getMoodLogs(),
    completedDevotionals: getCompletedDevotionalMap(),
    bookmarkedDevotionals: getBookmarkedDevotionalIds(),
    favoriteHymns: getFavoriteHymnIds(),
    userStats: getUserStats(),
    libraryProgress: getLibraryProgressMap(),
    prayerInteractions: getPrayerInteractions(),
    bibleBookmarks: Array.isArray(bibleBookmarks) ? bibleBookmarks : [],
    bibleHistory: Array.isArray(bibleHistory) ? bibleHistory : [],
  };

  return JSON.stringify(payload, null, 2);
}

export function importAllUserData(jsonString: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonString) as Partial<PersonalDataBackup>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, message: 'Invalid backup file format.' };
    }
    if (Array.isArray(parsed.journalEntries)) saveJournalEntries(parsed.journalEntries);
    if (Array.isArray(parsed.personalPrayers)) savePersonalPrayers(parsed.personalPrayers);
    if (parsed.moodLogs && typeof parsed.moodLogs === 'object') saveMoodLogs(parsed.moodLogs);
    if (parsed.completedDevotionals && typeof parsed.completedDevotionals === 'object') {
      saveCompletedDevotionalMap(parsed.completedDevotionals);
    }
    if (Array.isArray(parsed.bookmarkedDevotionals)) {
      saveBookmarkedDevotionalIds(parsed.bookmarkedDevotionals);
    }
    if (Array.isArray(parsed.favoriteHymns)) saveFavoriteHymnIds(parsed.favoriteHymns);
    if (parsed.userStats && typeof parsed.userStats === 'object') saveUserStats(parsed.userStats);
    if (parsed.libraryProgress && typeof parsed.libraryProgress === 'object') {
      localStorage.setItem('faith_library_progress', JSON.stringify(parsed.libraryProgress));
    }
    if (parsed.prayerInteractions && typeof parsed.prayerInteractions === 'object') {
      savePrayerInteractions(parsed.prayerInteractions);
    }
    if (Array.isArray(parsed.bibleBookmarks)) {
      localStorage.setItem('bible_bookmarks', JSON.stringify(parsed.bibleBookmarks));
    }
    if (Array.isArray(parsed.bibleHistory)) {
      localStorage.setItem('bible_history', JSON.stringify(parsed.bibleHistory));
    }
    return { ok: true, message: 'Personal data backup restored successfully!' };
  } catch {
    return { ok: false, message: 'Could not parse backup file. Ensure it is a valid Believers Library JSON export.' };
  }
}
