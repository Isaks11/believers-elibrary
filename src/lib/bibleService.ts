/**
 * Bible Service
 *
 * Provides Bible book metadata, verse parsing, reference formatting,
 * and live fetching from bible-api.com across supported translations (KJV, WEB, ASV, BBE).
 */

import type { BibleVersion } from '@/types/devotional-hymn';

export interface BibleBookMeta {
  name: string;
  chapters: number;
  testament: 'OT' | 'NT';
}

export const BIBLE_BOOKS: BibleBookMeta[] = [
  // Old Testament (39 Books)
  { name: 'Genesis', chapters: 50, testament: 'OT' },
  { name: 'Exodus', chapters: 40, testament: 'OT' },
  { name: 'Leviticus', chapters: 27, testament: 'OT' },
  { name: 'Numbers', chapters: 36, testament: 'OT' },
  { name: 'Deuteronomy', chapters: 34, testament: 'OT' },
  { name: 'Joshua', chapters: 24, testament: 'OT' },
  { name: 'Judges', chapters: 21, testament: 'OT' },
  { name: 'Ruth', chapters: 4, testament: 'OT' },
  { name: '1 Samuel', chapters: 31, testament: 'OT' },
  { name: '2 Samuel', chapters: 24, testament: 'OT' },
  { name: '1 Kings', chapters: 22, testament: 'OT' },
  { name: '2 Kings', chapters: 25, testament: 'OT' },
  { name: '1 Chronicles', chapters: 29, testament: 'OT' },
  { name: '2 Chronicles', chapters: 36, testament: 'OT' },
  { name: 'Ezra', chapters: 10, testament: 'OT' },
  { name: 'Nehemiah', chapters: 13, testament: 'OT' },
  { name: 'Esther', chapters: 10, testament: 'OT' },
  { name: 'Job', chapters: 42, testament: 'OT' },
  { name: 'Psalms', chapters: 150, testament: 'OT' },
  { name: 'Proverbs', chapters: 31, testament: 'OT' },
  { name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
  { name: 'Song of Solomon', chapters: 8, testament: 'OT' },
  { name: 'Isaiah', chapters: 66, testament: 'OT' },
  { name: 'Jeremiah', chapters: 52, testament: 'OT' },
  { name: 'Lamentations', chapters: 5, testament: 'OT' },
  { name: 'Ezekiel', chapters: 48, testament: 'OT' },
  { name: 'Daniel', chapters: 12, testament: 'OT' },
  { name: 'Hosea', chapters: 14, testament: 'OT' },
  { name: 'Joel', chapters: 3, testament: 'OT' },
  { name: 'Amos', chapters: 9, testament: 'OT' },
  { name: 'Obadiah', chapters: 1, testament: 'OT' },
  { name: 'Jonah', chapters: 4, testament: 'OT' },
  { name: 'Micah', chapters: 7, testament: 'OT' },
  { name: 'Nahum', chapters: 3, testament: 'OT' },
  { name: 'Habakkuk', chapters: 3, testament: 'OT' },
  { name: 'Zephaniah', chapters: 3, testament: 'OT' },
  { name: 'Haggai', chapters: 2, testament: 'OT' },
  { name: 'Zechariah', chapters: 14, testament: 'OT' },
  { name: 'Malachi', chapters: 4, testament: 'OT' },
  // New Testament (27 Books)
  { name: 'Matthew', chapters: 28, testament: 'NT' },
  { name: 'Mark', chapters: 16, testament: 'NT' },
  { name: 'Luke', chapters: 24, testament: 'NT' },
  { name: 'John', chapters: 21, testament: 'NT' },
  { name: 'Acts', chapters: 28, testament: 'NT' },
  { name: 'Romans', chapters: 16, testament: 'NT' },
  { name: '1 Corinthians', chapters: 16, testament: 'NT' },
  { name: '2 Corinthians', chapters: 13, testament: 'NT' },
  { name: 'Galatians', chapters: 6, testament: 'NT' },
  { name: 'Ephesians', chapters: 6, testament: 'NT' },
  { name: 'Philippians', chapters: 4, testament: 'NT' },
  { name: 'Colossians', chapters: 4, testament: 'NT' },
  { name: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { name: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { name: '1 Timothy', chapters: 6, testament: 'NT' },
  { name: '2 Timothy', chapters: 4, testament: 'NT' },
  { name: 'Titus', chapters: 3, testament: 'NT' },
  { name: 'Philemon', chapters: 1, testament: 'NT' },
  { name: 'Hebrews', chapters: 13, testament: 'NT' },
  { name: 'James', chapters: 5, testament: 'NT' },
  { name: '1 Peter', chapters: 5, testament: 'NT' },
  { name: '2 Peter', chapters: 3, testament: 'NT' },
  { name: '1 John', chapters: 5, testament: 'NT' },
  { name: '2 John', chapters: 1, testament: 'NT' },
  { name: '3 John', chapters: 1, testament: 'NT' },
  { name: 'Jude', chapters: 1, testament: 'NT' },
  { name: 'Revelation', chapters: 22, testament: 'NT' },
];

export interface ParsedBibleRef {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export interface FetchedVerseResult {
  reference: string;
  text: string;
  version: BibleVersion;
}

// In-memory cache for fetched verse texts: `${ref}:${version}` -> text
const verseCache = new Map<string, string>();

/** Maps app BibleVersion to bible-api.com translation codes */
const TRANSLATION_API_CODES: Record<BibleVersion, string> = {
  KJV: 'kjv',
  WEB: 'web',
  ASV: 'asv',
  BBE: 'bbe',
  ESV: 'web', // ESV is copyrighted on public API, fallback to modern English (WEB)
};

/**
 * Parses a scripture reference string into structured components.
 * e.g. "John 3:16" -> { book: "John", chapter: 3, verseStart: 16 }
 * e.g. "Romans 8:28-30" -> { book: "Romans", chapter: 8, verseStart: 28, verseEnd: 30 }
 * e.g. "1 Corinthians 13" -> { book: "1 Corinthians", chapter: 13 }
 */
export function parseBibleRef(rawRef: string): ParsedBibleRef | null {
  if (!rawRef || typeof rawRef !== 'string') return null;
  const trimmed = rawRef.trim();

  // Try matching with verse range: "Book Chapter:Start-End" or "Book Chapter:Start"
  const regex = /^([1-3]?\s*[a-zA-Z\s]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/;
  const match = trimmed.match(regex);
  if (!match) return null;

  const bookName = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
  const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;

  // Validate book name matches one of the 66 books
  const matchedBook = BIBLE_BOOKS.find(
    (b) => b.name.toLowerCase() === bookName.toLowerCase()
  );

  return {
    book: matchedBook ? matchedBook.name : bookName,
    chapter,
    verseStart,
    verseEnd,
  };
}

/**
 * Formats structured Bible reference components into standard string.
 * e.g. formatBibleRef("John", 3, 16) -> "John 3:16"
 * e.g. formatBibleRef("Romans", 8, 28, 30) -> "Romans 8:28-30"
 * e.g. formatBibleRef("Psalm", 23) -> "Psalm 23"
 */
export function formatBibleRef(
  book: string,
  chapter: number,
  verseStart?: number | null,
  verseEnd?: number | null
): string {
  if (!verseStart) return `${book} ${chapter}`;
  if (verseEnd && verseEnd > verseStart) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`;
  }
  return `${book} ${chapter}:${verseStart}`;
}

/**
 * Fetches the scripture text for a reference from bible-api.com.
 * Caches results in memory to make translation switching instant.
 */
export async function fetchVerseText(
  reference: string,
  version: BibleVersion = 'KJV'
): Promise<FetchedVerseResult | null> {
  const cleanRef = reference.trim();
  if (!cleanRef) return null;

  const cacheKey = `${cleanRef.toLowerCase()}:${version}`;
  if (verseCache.has(cacheKey)) {
    return {
      reference: cleanRef,
      text: verseCache.get(cacheKey)!,
      version,
    };
  }

  const apiCode = TRANSLATION_API_CODES[version] || 'kjv';

  try {
    const url = `https://bible-api.com/${encodeURIComponent(cleanRef)}?translation=${apiCode}`;
    const res = await fetch(url);
    if (!res.ok) {
      // If specific translation fails (or 404), try KJV fallback
      if (apiCode !== 'kjv') {
        const fallbackRes = await fetch(
          `https://bible-api.com/${encodeURIComponent(cleanRef)}?translation=kjv`
        );
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData?.text) {
            const cleanText = String(fallbackData.text).trim();
            verseCache.set(cacheKey, cleanText);
            return {
              reference: fallbackData.reference || cleanRef,
              text: cleanText,
              version,
            };
          }
        }
      }
      return null;
    }

    const data = await res.json();
    if (!data?.text) return null;

    const cleanText = String(data.text).trim();
    verseCache.set(cacheKey, cleanText);

    return {
      reference: data.reference || cleanRef,
      text: cleanText,
      version,
    };
  } catch (err) {
    console.warn('Failed to fetch verse from bible-api.com:', err);
    return null;
  }
}
