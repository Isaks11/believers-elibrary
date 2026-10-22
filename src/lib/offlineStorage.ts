/**
 * Offline-First PWA & IndexedDB Scripture Storage Manager (Phase 3 — Stage 2)
 *
 * Responsibilities:
 * 1. Persist downloaded Bible chapters in IndexedDB (`believers_elibrary_offline_db`)
 *    with automatic fallback & synchronization to `localStorage` (`bible_chapter_cache`)
 *    so existing Phase 2 data is preserved and works without a network connection.
 * 2. Monitor storage quota (`navigator.storage.estimate()`) and handle quota/storage errors safely.
 * 3. Manage Service Worker registration (`/sw.js`), update detection, and safe `SKIP_WAITING` activation.
 */

const DB_NAME = 'believers_elibrary_offline_db';
const DB_VERSION = 1;
const CHAPTER_STORE = 'bible_chapters';
const LEGACY_CACHE_KEY = 'bible_chapter_cache';

export interface StoredBibleChapter {
  key: string; // e.g. "Genesis 1:KJV"
  chapterRef: string; // e.g. "Genesis 1"
  translation: string; // e.g. "KJV"
  verses: string[];
  savedAt: string;
}

export interface StorageQuotaStats {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  offlineChapterCount: number;
  indexedDbAvailable: boolean;
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
          db.createObjectStore(CHAPTER_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLegacyCache(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LEGACY_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLegacyCache(cache: Record<string, string[]>): boolean {
  try {
    localStorage.setItem(LEGACY_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a Bible chapter into IndexedDB and mirrors to localStorage fallback.
 * Returns `{ ok: boolean; error?: string }`.
 */
export async function saveOfflineBibleChapter(
  chapterRef: string,
  translation: string,
  verses: string[]
): Promise<{ ok: boolean; storage: 'indexeddb' | 'localstorage' | 'none'; error?: string }> {
  if (!Array.isArray(verses) || verses.length === 0) {
    return { ok: false, storage: 'none', error: 'Cannot store empty chapter verses' };
  }

  const key = `${chapterRef}:${translation}`;
  const record: StoredBibleChapter = {
    key,
    chapterRef,
    translation,
    verses,
    savedAt: new Date().toISOString(),
  };

  // Mirror to localStorage for backward compatibility with synchronous readers
  const legacy = readLegacyCache();
  legacy[key] = verses;
  const legacySaved = writeLegacyCache(legacy);

  const db = await openOfflineDb();
  if (!db) {
    return legacySaved
      ? { ok: true, storage: 'localstorage' }
      : { ok: false, storage: 'none', error: 'Offline storage quota exceeded or unavailable' };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CHAPTER_STORE, 'readwrite');
      const store = tx.objectStore(CHAPTER_STORE);
      store.put(record);
      tx.oncomplete = () => {
        db.close();
        resolve({ ok: true, storage: 'indexeddb' });
      };
      tx.onerror = () => {
        db.close();
        resolve(
          legacySaved
            ? { ok: true, storage: 'localstorage' }
            : { ok: false, storage: 'none', error: 'IndexedDB write failed' }
        );
      };
    } catch (err) {
      db.close();
      resolve(
        legacySaved
          ? { ok: true, storage: 'localstorage' }
          : { ok: false, storage: 'none', error: err instanceof Error ? err.message : 'Storage failure' }
      );
    }
  });
}

/**
 * Retrieves a Bible chapter from IndexedDB (or localStorage fallback) without network access.
 */
export async function getOfflineBibleChapter(
  chapterRef: string,
  translation: string
): Promise<string[] | null> {
  const key = `${chapterRef}:${translation}`;
  const db = await openOfflineDb();

  if (db) {
    const fromIdb = await new Promise<string[] | null>((resolve) => {
      try {
        const tx = db.transaction(CHAPTER_STORE, 'readonly');
        const store = tx.objectStore(CHAPTER_STORE);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result as StoredBibleChapter | undefined;
          resolve(res && Array.isArray(res.verses) && res.verses.length > 0 ? res.verses : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    db.close();
    if (fromIdb) return fromIdb;
  }

  const legacy = readLegacyCache();
  return Array.isArray(legacy[key]) && legacy[key].length > 0 ? legacy[key] : null;
}

/**
 * Migrates any existing Phase 2 localStorage chapters into IndexedDB.
 */
export async function migrateLegacyChaptersToIndexedDB(): Promise<number> {
  const legacy = readLegacyCache();
  const entries = Object.entries(legacy);
  if (entries.length === 0) return 0;

  const db = await openOfflineDb();
  if (!db) return 0;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CHAPTER_STORE, 'readwrite');
      const store = tx.objectStore(CHAPTER_STORE);
      let count = 0;
      for (const [key, verses] of entries) {
        if (!Array.isArray(verses) || verses.length === 0) continue;
        const [chapterRef, translation] = key.split(':');
        if (!chapterRef || !translation) continue;
        store.put({
          key,
          chapterRef,
          translation,
          verses,
          savedAt: new Date().toISOString(),
        } satisfies StoredBibleChapter);
        count++;
      }
      tx.oncomplete = () => {
        db.close();
        resolve(count);
      };
      tx.onerror = () => {
        db.close();
        resolve(0);
      };
    } catch {
      db.close();
      resolve(0);
    }
  });
}

/**
 * Lists all chapter keys currently stored offline across IndexedDB and localStorage.
 */
export async function listOfflineBibleChapterKeys(): Promise<string[]> {
  const keys = new Set<string>(Object.keys(readLegacyCache()));
  const db = await openOfflineDb();
  if (db) {
    const idbKeys = await new Promise<string[]>((resolve) => {
      try {
        const tx = db.transaction(CHAPTER_STORE, 'readonly');
        const store = tx.objectStore(CHAPTER_STORE);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve((req.result || []).map(String));
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    db.close();
    idbKeys.forEach((k) => keys.add(k));
  }
  return Array.from(keys);
}

/**
 * Returns storage quota metrics and offline chapter count.
 */
export async function getStorageQuotaStats(): Promise<StorageQuotaStats> {
  const keys = await listOfflineBibleChapterKeys();
  let usageBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch {
      /* ignore estimate failure */
    }
  }

  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 1000) / 10) : 0;

  return {
    usageBytes,
    quotaBytes,
    percentUsed,
    offlineChapterCount: keys.length,
    indexedDbAvailable: typeof indexedDB !== 'undefined',
  };
}

let swRegistration: ServiceWorkerRegistration | null = null;

export function registerOfflineServiceWorker(onUpdateAvailable?: () => void): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        swRegistration = reg;
        if (reg.waiting && onUpdateAvailable) {
          onUpdateAvailable();
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller && onUpdateAvailable) {
              onUpdateAvailable();
            }
          });
        });
      })
      .catch(() => {
        /* Service worker registration may fail on non-HTTPS dev origins */
      });
  });
}

export function applyServiceWorkerUpdate(): void {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}
