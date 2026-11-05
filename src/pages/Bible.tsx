import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  Settings,
  Bookmark,
  BookmarkCheck,
  History,
  Volume2,
  Square,
  Moon,
  Sun,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  PenLine,
  Highlighter,
  Download,
  CheckCircle2,
  StickyNote,
  ShieldCheck,
  CornerDownRight,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { addJournalEntry } from '@/data/journalData';
import {
  getOfflineBibleChapter,
  saveOfflineBibleChapter,
  migrateLegacyChaptersToIndexedDB,
  getStorageQuotaStats,
  StorageQuotaStats,
} from '@/lib/offlineStorage';
import { OFFLINE_CHAPTERS } from '@/data/offlineBibleChapters';

export type TranslationKey = 'KJV' | 'WEB' | 'ASV' | 'BBE';

export type HighlightColor = 'amber' | 'emerald' | 'sky' | 'rose';

const TRANSLATIONS: {
  key: TranslationKey;
  label: string;
  apiCode: string;
  license: string;
  source: string;
}[] = [
  {
    key: 'KJV',
    label: 'King James Version (1769)',
    apiCode: 'kjv',
    license: 'Public Domain — Unencumbered worldwide distribution permitted',
    source: 'Oxford Standard Text (1769) / bible-api.com',
  },
  {
    key: 'WEB',
    label: 'World English Bible (Modern English)',
    apiCode: 'web',
    license: 'Public Domain — Dedicated to the Public Domain by Rainbow Missions, Inc.',
    source: 'ebible.org / World English Bible Project',
  },
  {
    key: 'ASV',
    label: 'American Standard Version (1901)',
    apiCode: 'asv',
    license: 'Public Domain (Published 1901)',
    source: 'American Revision Committee (1901)',
  },
  {
    key: 'BBE',
    label: 'Bible in Basic English (1949/1965)',
    apiCode: 'bbe',
    license: 'Public Domain (Cambridge University Press)',
    source: 'S.H. Hooke — Basic English Scripture Translation',
  },
];

export const BIBLE_BOOKS: { name: string; chapters: number; testament: 'OT' | 'NT' }[] = [
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

const BOOKMARKS_KEY = 'bible_bookmarks';
const HIGHLIGHTS_KEY = 'bible_highlights';
const HIGHLIGHT_COLORS_KEY = 'bible_highlight_colors';
const VERSE_NOTES_KEY = 'bible_verse_notes';
const HISTORY_KEY = 'bible_history';
const CACHE_KEY = 'bible_chapter_cache';

/** Build a bible-api.com URL, handling single-chapter books (Jude, Philemon, …). */
function bibleApiUrl(bookName: string, chapterNum: number, translation: TranslationKey): string {
  const apiTrans = TRANSLATIONS.find((t) => t.key === translation)?.apiCode || 'kjv';
  const params = new URLSearchParams({ translation: apiTrans });
  // Without this, bible-api.com reads "Jude 1" as *verse* 1 instead of the whole book.
  const meta = BIBLE_BOOKS.find((b) => b.name === bookName);
  if (meta?.chapters === 1) params.set('single_chapter_book_matching', 'indifferent');
  return `https://bible-api.com/${encodeURIComponent(`${bookName} ${chapterNum}`)}?${params.toString()}`;
}

/** Fetch a complete chapter (all verses) from bible-api.com. */
async function fetchChapterText(
  bookName: string,
  chapterNum: number,
  translation: TranslationKey
): Promise<string[]> {
  const res = await fetch(bibleApiUrl(bookName, chapterNum, translation));
  if (!res.ok) throw new Error(`Bible service returned HTTP ${res.status}`);
  const data = await res.json();
  const texts = Array.isArray(data?.verses)
    ? data.verses.map((v: { text?: string }) => String(v.text || '').replace(/\s+/g, ' ').trim())
    : [];
  if (texts.length === 0) throw new Error('Bible service returned an empty chapter');
  return texts;
}

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveList(key: string, items: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function loadMap<T = string>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMap<T = string>(key: string, map: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

const HIGHLIGHT_BG_CLASSES: Record<HighlightColor, string> = {
  amber: 'bg-amber-200/50 dark:bg-amber-500/25',
  emerald: 'bg-emerald-200/50 dark:bg-emerald-500/25',
  sky: 'bg-sky-200/50 dark:bg-sky-500/25',
  rose: 'bg-rose-200/50 dark:bg-rose-500/25',
};

export function Bible() {
  const navigate = useNavigate();
  const [version, setVersion] = useState<TranslationKey>('KJV');
  const [book, setBook] = useState('Genesis');
  const [chapter, setChapter] = useState(1);
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [isParallel, setIsParallel] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [verses, setVerses] = useState<string[]>([]);
  const [parallelVerses, setParallelVerses] = useState<string[]>([]);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [downloadingPack, setDownloadingPack] = useState(false);

  const [bookmarks, setBookmarks] = useState<string[]>(() => loadList(BOOKMARKS_KEY));
  const [highlights, setHighlights] = useState<string[]>(() => loadList(HIGHLIGHTS_KEY));
  const [highlightColors, setHighlightColors] = useState<Record<string, HighlightColor>>(() =>
    loadMap<HighlightColor>(HIGHLIGHT_COLORS_KEY)
  );
  const [verseNotes, setVerseNotes] = useState<Record<string, string>>(() => loadMap<string>(VERSE_NOTES_KEY));
  const [history, setHistory] = useState<string[]>(() => loadList(HISTORY_KEY));

  // Modals & inline note editing
  const [pickerOpen, setPickerOpen] = useState(false);
  const [versePickerOpen, setVersePickerOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVerseIdx, setSelectedVerseIdx] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteVerseNum, setEditingNoteVerseNum] = useState<number | null>(null);
  const [quotaStats, setQuotaStats] = useState<StorageQuotaStats | null>(null);
  const verseRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const refreshQuotaStats = () => {
    getStorageQuotaStats().then(setQuotaStats);
  };

  // Consume deep-link jump and migrate legacy localStorage chapters to IndexedDB on mount
  useEffect(() => {
    migrateLegacyChaptersToIndexedDB().then(() => refreshQuotaStats());
    try {
      const jumpRaw = localStorage.getItem('bible_target_jump');
      if (jumpRaw) {
        localStorage.removeItem('bible_target_jump');
        const parsed = JSON.parse(jumpRaw) as { book?: string; chapter?: number };
        if (parsed.book && BIBLE_BOOKS.some((b) => b.name === parsed.book)) {
          setBook(parsed.book);
          setChapter(Number(parsed.chapter) || 1);
          toast.info(`Opened ${parsed.book} ${parsed.chapter || 1}`);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const chapterRef = `${book} ${chapter}`;
  const isChapterBookmarked = bookmarks.includes(chapterRef);

  // Clear any verse selection when navigating to another chapter/translation.
  useEffect(() => {
    setSelectedVerseIdx(null);
    setEditingNoteVerseNum(null);
  }, [chapterRef, version]);

  // Record history and load chapter text (IndexedDB cache -> complete bundled chapters -> bible-api.com)
  useEffect(() => {
    let cancelled = false;
    const nextHistory = [chapterRef, ...loadList(HISTORY_KEY).filter((r) => r !== chapterRef)].slice(0, 35);
    saveList(HISTORY_KEY, nextHistory);
    setHistory(nextHistory);
    setLoadError(null);

    const loadChapter = async () => {
      // 1. Check the complete chapter cache first (IndexedDB, localStorage fallback)
      const cachedVerses = await getOfflineBibleChapter(chapterRef, version);
      if (cancelled) return;
      if (cachedVerses && cachedVerses.length > 0) {
        const altTrans = version === 'KJV' ? 'WEB' : 'KJV';
        const altVerses = await getOfflineBibleChapter(chapterRef, altTrans);
        if (cancelled) return;
        setVerses(cachedVerses);
        setParallelVerses(altVerses || []);
        setIsOfflineCached(true);
        setLoadingChapter(false);
        return;
      }

      // 2. Bundled complete chapters — KJV/WEB only. Never silently present KJV/WEB
      //    text as ASV/BBE.
      const offline = OFFLINE_CHAPTERS[chapterRef];
      if (offline && (version === 'KJV' || version === 'WEB')) {
        setVerses(version === 'WEB' ? offline.WEB : offline.KJV);
        setParallelVerses(version === 'WEB' ? offline.KJV : offline.WEB);
        setIsOfflineCached(true);
        setLoadingChapter(false);
        return;
      }

      // 3. Fetch the full chapter from bible-api.com and persist it for offline use
      setIsOfflineCached(false);
      setLoadingChapter(true);

      try {
        const texts = await fetchChapterText(book, chapter, version);
        if (cancelled) return;
        setVerses(texts);
        // The companion translation is loaded lazily when parallel view is enabled.
        setParallelVerses([]);
        const saved = await saveOfflineBibleChapter(chapterRef, version, texts);
        if (!cancelled) {
          setIsOfflineCached(saved.ok);
          refreshQuotaStats();
        }
      } catch {
        if (cancelled) return;
        if (offline) {
          // A complete bundled chapter beats an empty reader, but disclose the translation.
          setVerses(offline.KJV);
          setParallelVerses(offline.WEB);
          setIsOfflineCached(true);
          toast.error(`Could not fetch ${chapterRef} (${version}); showing bundled KJV/WEB text.`);
        } else {
          setVerses([]);
          setParallelVerses([]);
          setIsOfflineCached(false);
          setLoadError(
            navigator.onLine
              ? `Could not load ${chapterRef}. The Bible service may be unavailable — check your connection and try again.`
              : `${chapterRef} is not downloaded for offline use. Connect to the internet or download it first.`
          );
          toast.error(`Could not load ${chapterRef}.`);
        }
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    };

    loadChapter();

    return () => {
      cancelled = true;
    };
  }, [book, chapter, version, chapterRef, reloadKey]);

  // Parallel view fetches the companion translation only while it is on screen.
  useEffect(() => {
    if (!isParallel || verses.length === 0) return;
    let cancelled = false;
    const altKey: TranslationKey = version === 'KJV' ? 'WEB' : 'KJV';

    (async () => {
      const cachedAlt = await getOfflineBibleChapter(chapterRef, altKey);
      if (cancelled) return;
      if (cachedAlt && cachedAlt.length > 0) {
        setParallelVerses(cachedAlt);
        return;
      }

      const offline = OFFLINE_CHAPTERS[chapterRef];
      if (offline) {
        setParallelVerses(altKey === 'KJV' ? offline.KJV : offline.WEB);
        return;
      }

      try {
        const texts = await fetchChapterText(book, chapter, altKey);
        if (cancelled) return;
        setParallelVerses(texts);
        await saveOfflineBibleChapter(chapterRef, altKey, texts);
        refreshQuotaStats();
      } catch {
        if (!cancelled) {
          setParallelVerses([]);
          toast.error(`Could not load the ${altKey} parallel text.`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isParallel, chapterRef, version, book, chapter, verses.length]);

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Parse reference jump if user types e.g. "John 3" or "Romans 8"
  const referenceMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 3) return null;
    for (const b of BIBLE_BOOKS) {
      const bLower = b.name.toLowerCase();
      if (q.startsWith(bLower)) {
        const rest = q.slice(bLower.length).trim();
        const chapNum = parseInt(rest.split(':')[0], 10);
        if (!isNaN(chapNum) && chapNum >= 1 && chapNum <= b.chapters) {
          return { book: b.name, chapter: chapNum };
        }
        if (!rest) {
          return { book: b.name, chapter: 1 };
        }
      }
    }
    return null;
  }, [searchQuery]);

  const filteredVerses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return verses.map((text, idx) => ({ idx, text }));
    return verses
      .map((text, idx) => ({ idx, text }))
      .filter((v) => v.text.toLowerCase().includes(q) || String(v.idx + 1) === q);
  }, [verses, searchQuery]);

  // Cross-chapter search across built-in & cached offline chapters
  const crossChapterMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 3) return [];
    const results: { ref: string; book: string; chapter: number; verseNum: number; snippet: string }[] = [];
    const seen = new Set<string>();

    // Search built-in offline chapters
    for (const [chapKey, transObj] of Object.entries(OFFLINE_CHAPTERS)) {
      if (chapKey === chapterRef) continue;
      const list = version === 'WEB' ? transObj.WEB : transObj.KJV;
      list.forEach((line, idx) => {
        if (line.toLowerCase().includes(q) && results.length < 8) {
          const lastSpace = chapKey.lastIndexOf(' ');
          const bName = chapKey.slice(0, lastSpace);
          const cNum = Number(chapKey.slice(lastSpace + 1)) || 1;
          const id = `${chapKey}:${idx + 1}`;
          if (!seen.has(id)) {
            seen.add(id);
            results.push({ ref: id, book: bName, chapter: cNum, verseNum: idx + 1, snippet: line });
          }
        }
      });
    }

    // Search cached chapters in localStorage
    const cache = loadMap<string[]>(CACHE_KEY);
    for (const [cacheKey, list] of Object.entries(cache)) {
      const [chapKey] = cacheKey.split(':');
      if (chapKey === chapterRef) continue;
      list.forEach((line, idx) => {
        if (line.toLowerCase().includes(q) && results.length < 8) {
          const lastSpace = chapKey.lastIndexOf(' ');
          const bName = chapKey.slice(0, lastSpace);
          const cNum = Number(chapKey.slice(lastSpace + 1)) || 1;
          const id = `${chapKey}:${idx + 1}`;
          if (!seen.has(id)) {
            seen.add(id);
            results.push({ ref: id, book: bName, chapter: cNum, verseNum: idx + 1, snippet: line });
          }
        }
      });
    }

    return results;
  }, [searchQuery, chapterRef, version]);

  const handleToggleChapterBookmark = () => {
    const exists = bookmarks.includes(chapterRef);
    const updated = exists ? bookmarks.filter((b) => b !== chapterRef) : [chapterRef, ...bookmarks];
    setBookmarks(updated);
    saveList(BOOKMARKS_KEY, updated);
    toast.success(exists ? `Removed ${chapterRef} from bookmarks` : `Bookmarked ${chapterRef}`);
  };

  const handleSetVerseHighlight = (verseNum: number, color: HighlightColor | null) => {
    const key = `${chapterRef}:${verseNum}`;
    const nextColors = { ...highlightColors };
    let nextHighlights = [...highlights];

    if (color === null) {
      delete nextColors[key];
      nextHighlights = nextHighlights.filter((h) => h !== key);
      toast.info('Highlight removed');
    } else {
      nextColors[key] = color;
      if (!nextHighlights.includes(key)) {
        nextHighlights.push(key);
      }
      toast.success(`Highlighted ${key} (${color})`);
    }

    setHighlightColors(nextColors);
    saveMap(HIGHLIGHT_COLORS_KEY, nextColors);
    setHighlights(nextHighlights);
    saveList(HIGHLIGHTS_KEY, nextHighlights);
    setSelectedVerseIdx(null);
  };

  const handleSaveInlineNote = (verseNum: number) => {
    const key = `${chapterRef}:${verseNum}`;
    const trimmed = noteDraft.trim();
    const nextNotes = { ...verseNotes };
    if (!trimmed) {
      delete nextNotes[key];
      toast.info('Removed inline verse note');
    } else {
      nextNotes[key] = trimmed;
      toast.success(`Saved note on ${key}`);
    }
    setVerseNotes(nextNotes);
    saveMap(VERSE_NOTES_KEY, nextNotes);
    setEditingNoteVerseNum(null);
    setNoteDraft('');
  };

  const handleJournalVerse = (verseNum: number, text: string) => {
    const ref = `${chapterRef}:${verseNum} (${version})`;
    addJournalEntry({
      title: `Scripture Note: ${ref}`,
      body: `"${text}"\n\nPersonal reflection:`,
      type: 'Notes',
      scriptureRef: `${chapterRef}:${verseNum}`,
    });
    setSelectedVerseIdx(null);
    toast.success('Saved verse to your Journal!');
    navigate('/journal');
  };

  const handleDownloadBookOffline = async () => {
    if (downloadingPack) return;
    setDownloadingPack(true);
    const currentBook = BIBLE_BOOKS.find((b) => b.name === book) || BIBLE_BOOKS[0];
    const maxChaps = Math.min(currentBook.chapters, 5); // Download up to 5 chapters per pack to respect API rate limits
    const apiTrans = TRANSLATIONS.find((t) => t.key === version)?.apiCode || 'kjv';
    let savedCount = 0;

    toast.info(`Downloading ${book} chapters 1–${maxChaps} (${version}) into IndexedDB for offline reading...`);

    for (let c = 1; c <= maxChaps; c++) {
      const ref = `${book} ${c}`;
      const existing = await getOfflineBibleChapter(ref, version);
      if (existing || OFFLINE_CHAPTERS[ref]) {
        savedCount++;
        continue;
      }
      try {
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${apiTrans}`);
        const data = await res.json();
        if (Array.isArray(data?.verses) && data.verses.length > 0) {
          const versesArr = data.verses.map((v: { text?: string }) => String(v.text || '').trim());
          const saved = await saveOfflineBibleChapter(ref, version, versesArr);
          if (saved.ok) savedCount++;
        }
      } catch {
        /* continue */
      }
    }

    setDownloadingPack(false);
    setIsOfflineCached(savedCount > 0);
    refreshQuotaStats();
    if (savedCount > 0) {
      toast.success(`Saved ${savedCount} chapters of ${book} (${version}) in IndexedDB for offline access!`);
    } else {
      toast.error('Could not download chapters offline — check your network connection.');
    }
  };

  const handleListen = () => {
    if (!('speechSynthesis' in window)) {
      toast.error('Audio speech synthesis is not supported on this browser');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${chapterRef}. ${verses.join(' ')}`);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
    toast.success(`Reading ${chapterRef} (${version}) aloud`);
  };

  const currentBookMeta = BIBLE_BOOKS.find((b) => b.name === book) || BIBLE_BOOKS[0];

  const stepChapter = (delta: number) => {
    const nextChap = chapter + delta;
    if (nextChap >= 1 && nextChap <= currentBookMeta.chapters) {
      setChapter(nextChap);
    } else if (nextChap > currentBookMeta.chapters) {
      const idx = BIBLE_BOOKS.findIndex((b) => b.name === book);
      const nextBook = BIBLE_BOOKS[(idx + 1) % BIBLE_BOOKS.length];
      setBook(nextBook.name);
      setChapter(1);
    } else if (nextChap < 1) {
      const idx = BIBLE_BOOKS.findIndex((b) => b.name === book);
      const prevBook = BIBLE_BOOKS[(idx - 1 + BIBLE_BOOKS.length) % BIBLE_BOOKS.length];
      setBook(prevBook.name);
      setChapter(prevBook.chapters);
    }
  };

  const selectVerse = (idx: number) => {
    setSelectedVerseIdx(idx);
    setVersePickerOpen(false);
    window.requestAnimationFrame(() => {
      verseRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const visibleBooks = useMemo(() => {
    if (testamentFilter === 'ALL') return BIBLE_BOOKS;
    return BIBLE_BOOKS.filter((b) => b.testament === testamentFilter);
  }, [testamentFilter]);

  return (
    <div
      className={cn(
        'space-y-5 pb-28 -mx-4 px-4 min-h-screen transition-colors',
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-background text-foreground'
      )}
    >
      <header className="sticky top-0 z-40 bg-inherit py-2 space-y-3 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVersionOpen(true)}
              className="bg-card text-foreground border-border/50 font-bold"
            >
              {version} <ChevronDown className="ml-1 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="bg-card text-foreground border-border/50 font-bold"
            >
              {chapterRef} <ChevronDown className="ml-1 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVersePickerOpen(true)}
              disabled={verses.length === 0}
              aria-label="Select a verse"
              title="Select a verse"
              className="bg-card text-foreground border-border/50 font-bold"
            >
              {selectedVerseIdx !== null ? `v. ${selectedVerseIdx + 1}` : 'Verse'}
              <ChevronDown className="ml-1 w-4 h-4" />
            </Button>
            {isOfflineCached && (
              <Badge variant="secondary" className="text-[9px] gap-1 hidden sm:inline-flex">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Offline
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownloadBookOffline}
              disabled={downloadingPack}
              title={`Download ${book} chapters for offline reading`}
              aria-label="Download offline chapters"
            >
              <Download className={cn('w-4 h-4', downloadingPack && 'animate-bounce text-accent')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Toggle reading theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Reader settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search keyword, verse #, or reference (e.g. "John 3")...`}
            className="pl-10 bg-card/60 text-foreground border-border/40 shadow-inner"
          />
        </div>

        {referenceMatch && (
          <button
            onClick={() => {
              setBook(referenceMatch.book);
              setChapter(referenceMatch.chapter);
              setSearchQuery('');
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-accent/15 border border-accent/30 text-xs font-bold text-primary hover:bg-accent/25 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 text-accent" /> Jump directly to {referenceMatch.book}{' '}
              {referenceMatch.chapter}
            </span>
            <Badge variant="default" className="text-[10px]">
              Open Chapter
            </Badge>
          </button>
        )}
      </header>

      {/* Continue Reading Banner if history has another recent chapter */}
      {history.length > 1 && !searchQuery && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/40 border border-border/40 text-xs">
          <span className="text-muted-foreground">
            Previous reading: <strong className="text-primary">{history[1]}</strong>
          </span>
          <button
            onClick={() => {
              const prev = history[1];
              const lastSpace = prev.lastIndexOf(' ');
              if (lastSpace > 0) {
                setBook(prev.slice(0, lastSpace));
                setChapter(Number(prev.slice(lastSpace + 1)) || 1);
              }
            }}
            className="font-bold text-accent hover:underline"
          >
            Resume →
          </button>
        </div>
      )}

      {/* Bible Content */}
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between py-2 border-b border-border/20">
          <Button variant="ghost" size="icon" onClick={() => stepChapter(-1)} aria-label="Previous chapter">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-2xl font-serif font-bold">{chapterRef}</h2>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isParallel
                ? `Parallel View (${version} / ${version === 'KJV' ? 'WEB' : 'KJV'})`
                : TRANSLATIONS.find((t) => t.key === version)?.label}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => stepChapter(1)} aria-label="Next chapter">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {!loadingChapter && verses.length > 0 && (
          <p className="text-[11px] text-center text-muted-foreground">
            Tap a verse to highlight, add a note, or reflect — or use "Verse" above to jump to one.
          </p>
        )}

        {loadingChapter ? (
          <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
            Loading {chapterRef} ({version})...
          </div>
        ) : (
          <div className="space-y-4 leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
            {filteredVerses.map(({ idx, text }) => {
              const verseNum = idx + 1;
              const highlightKey = `${chapterRef}:${verseNum}`;
              const isHighlighted = highlights.includes(highlightKey);
              const hlColor: HighlightColor = highlightColors[highlightKey] || 'amber';
              const savedNote = verseNotes[highlightKey];
              const isSelected = selectedVerseIdx === idx;
              const isEditingNote = editingNoteVerseNum === verseNum;

              return (
                <div
                  key={idx}
                  ref={(el) => {
                    verseRefs.current[idx] = el;
                  }}
                  className="space-y-2 scroll-mt-32"
                >
                  <div
                    onClick={() => setSelectedVerseIdx(isSelected ? null : idx)}
                    className={cn(
                      'flex gap-3 group rounded-xl p-2 -mx-2 transition-colors cursor-pointer',
                      isHighlighted && HIGHLIGHT_BG_CLASSES[hlColor],
                      isSelected && 'ring-2 ring-primary/40 bg-primary/5',
                      !isHighlighted && !isSelected && 'hover:bg-primary/5'
                    )}
                  >
                    <span className="text-xs font-bold text-muted-foreground pt-1.5 min-w-[22px]">
                      {verseNum}
                    </span>
                    <div className="flex-1 space-y-2">
                      <p className={cn(idx === 0 && 'font-semibold')}>{text}</p>
                      {isParallel && parallelVerses[idx] && (
                        <p className="text-sm italic text-muted-foreground border-l-2 border-accent pl-3">
                          <span className="text-[10px] font-bold uppercase not-italic mr-1.5">
                            {version === 'KJV' ? 'WEB:' : 'KJV:'}
                          </span>
                          {parallelVerses[idx]}
                        </p>
                      )}
                      {savedNote && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-foreground flex items-start gap-2">
                          <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{savedNote}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex flex-wrap items-center gap-2 pl-7">
                      <div className="flex items-center gap-1 bg-card border border-border/50 rounded-lg px-2 py-1">
                        <Highlighter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                        {(['amber', 'emerald', 'sky', 'rose'] as HighlightColor[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => handleSetVerseHighlight(verseNum, c)}
                            className={cn(
                              'w-4 h-4 rounded-full border border-black/10 transition-transform hover:scale-110',
                              c === 'amber' && 'bg-amber-400',
                              c === 'emerald' && 'bg-emerald-400',
                              c === 'sky' && 'bg-sky-400',
                              c === 'rose' && 'bg-rose-400'
                            )}
                            title={`Highlight ${c}`}
                          />
                        ))}
                        {isHighlighted && (
                          <button
                            onClick={() => handleSetVerseHighlight(verseNum, null)}
                            className="text-[10px] font-bold text-muted-foreground hover:text-destructive ml-1"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setEditingNoteVerseNum(isEditingNote ? null : verseNum);
                          setNoteDraft(savedNote || '');
                        }}
                      >
                        <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                        {savedNote ? 'Edit Note' : 'Add Note'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleJournalVerse(verseNum, text)}
                      >
                        <PenLine className="w-3.5 h-3.5 text-primary" /> Reflect in Journal
                      </Button>
                    </div>
                  )}

                  {isEditingNote && (
                    <div className="pl-7 flex gap-2 items-center">
                      <Input
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder={`Personal note on ${chapterRef}:${verseNum}...`}
                        className="h-8 text-xs"
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => handleSaveInlineNote(verseNum)}>
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cross-Chapter Search Results across offline & cached scripture */}
        {crossChapterMatches.length > 0 && (
          <div className="pt-4 border-t border-border/30 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Matches in Other Downloaded Chapters ({crossChapterMatches.length})
            </h4>
            <div className="space-y-2">
              {crossChapterMatches.map((m) => (
                <button
                  key={m.ref}
                  onClick={() => {
                    setBook(m.book);
                    setChapter(m.chapter);
                    setSearchQuery('');
                  }}
                  className="w-full text-left p-3 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all space-y-1"
                >
                  <span className="text-xs font-bold text-accent">{m.ref}</span>
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.snippet}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bible Footer Actions */}
      <div
        className={cn(
          'fixed bottom-20 left-4 right-4 max-w-md mx-auto p-2 rounded-2xl flex justify-around items-center backdrop-blur-xl border border-border/40 shadow-2xl z-40 transition-colors',
          isDarkMode ? 'bg-slate-900/90 text-white' : 'bg-white/90 text-primary'
        )}
      >
        <Button
          variant="ghost"
          onClick={handleToggleChapterBookmark}
          className={cn('flex-col gap-1 h-auto py-2', isChapterBookmarked && 'text-amber-500')}
        >
          {isChapterBookmarked ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
          <span className="text-[10px] font-bold uppercase">{isChapterBookmarked ? 'Saved' : 'Bookmark'}</span>
        </Button>
        <Button
          variant="ghost"
          onClick={handleListen}
          className={cn('flex-col gap-1 h-auto py-2', isSpeaking ? 'text-rose-500' : 'text-accent')}
        >
          {isSpeaking ? <Square className="w-5 h-5 fill-current" /> : <Volume2 className="w-5 h-5" />}
          <span className="text-[10px] font-bold uppercase">{isSpeaking ? 'Stop' : 'Listen'}</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setIsParallel(!isParallel);
            toast.info(!isParallel ? 'Parallel translation comparison enabled' : 'Single translation view');
          }}
          className={cn('flex-col gap-1 h-auto py-2', isParallel && 'bg-primary/10 text-primary')}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Parallel</span>
        </Button>
        <Button variant="ghost" onClick={() => setHistoryOpen(true)} className="flex-col gap-1 h-auto py-2">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">History</span>
        </Button>
      </div>

      {/* Translation Picker Dialog with Source & Licensing Verification */}
      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Authorized Bible Translations</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5 mt-2">
            {TRANSLATIONS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setVersion(t.key);
                  setVersionOpen(false);
                  toast.success(`Switched to ${t.key}`);
                }}
                className={cn(
                  'w-full p-3 rounded-xl text-left flex flex-col gap-1 border transition-all',
                  version === t.key ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-secondary/40'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-bold text-primary">
                    {t.key} — {t.label}
                  </span>
                  {version === t.key && <Badge>Active</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {t.license}
                </p>
                <p className="text-[10px] text-muted-foreground/80">Source: {t.source}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete 66-Book & Chapter Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[82vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Book (All 66 Books) & Chapter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-1.5 bg-secondary/40 p-1 rounded-xl">
              {(['ALL', 'OT', 'NT'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTestamentFilter(tab)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                    testamentFilter === tab
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-primary'
                  )}
                >
                  {tab === 'ALL' ? 'All (66)' : tab === 'OT' ? 'Old Testament (39)' : 'New Testament (27)'}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Select Book</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {visibleBooks.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => {
                      setBook(b.name);
                      setChapter(1);
                    }}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all flex items-center justify-between',
                      book === b.name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/40 text-primary hover:bg-secondary'
                    )}
                  >
                    <span className="truncate">{b.name}</span>
                    <span className="text-[10px] opacity-70">{b.chapters}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2">
                {book} — Select Chapter (1–{currentBookMeta.chapters})
              </p>
              <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {Array.from({ length: currentBookMeta.chapters }, (_, i) => i + 1).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setChapter(c);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      'h-9 rounded-lg text-xs font-bold transition-all',
                      chapter === c
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/40 text-primary hover:bg-secondary'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verse Picker Dialog */}
      <Dialog open={versePickerOpen} onOpenChange={setVersePickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Select a Verse in {chapterRef}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {verses.length === 0 ? (
              <p className="text-xs text-muted-foreground">This chapter has not loaded yet. Try again in a moment.</p>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-1.5 max-h-[55vh] overflow-y-auto pr-1">
                  {verses.map((text, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectVerse(idx)}
                      title={text}
                      aria-label={`Verse ${idx + 1}`}
                      className={cn(
                        'h-9 rounded-lg text-xs font-bold transition-all',
                        selectedVerseIdx === idx
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/40 text-primary hover:bg-secondary'
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {verses.length} verses — choose one to jump to it and open its highlight, note, and journal actions.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reader Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reader Preferences & Offline Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Font Size ({fontSize}px)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setFontSize((f) => Math.max(14, f - 2))}>
                  A-
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFontSize((f) => Math.min(26, f + 2))}>
                  A+
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Dark Reading Theme</span>
              <Button size="sm" variant="outline" onClick={() => setIsDarkMode(!isDarkMode)}>
                {isDarkMode ? 'Disable' : 'Enable'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Parallel Translation View</span>
              <Button size="sm" variant="outline" onClick={() => setIsParallel(!isParallel)}>
                {isParallel ? 'Disable' : 'Enable'}
              </Button>
            </div>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Offline Chapter Pack (IndexedDB)</p>
                <p className="text-xs text-muted-foreground">Cache {book} chapters for offline reading</p>
              </div>
              <Button size="sm" onClick={handleDownloadBookOffline} disabled={downloadingPack} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                {downloadingPack ? 'Saving...' : 'Download'}
              </Button>
            </div>
            {quotaStats && (
              <div className="p-3 rounded-xl bg-secondary/40 border border-border/40 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offline Chapters Stored:</span>
                  <span className="font-bold text-primary">
                    {quotaStats.offlineChapterCount + Object.keys(OFFLINE_CHAPTERS).length} chapters
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Engine:</span>
                  <span className="font-bold text-emerald-700">
                    {quotaStats.indexedDbAvailable ? 'IndexedDB + Local Fallback' : 'LocalStorage Fallback'}
                  </span>
                </div>
                {quotaStats.quotaBytes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Device Quota Used:</span>
                    <span className="font-mono text-[11px]">
                      {(quotaStats.usageBytes / (1024 * 1024)).toFixed(2)} MB ({quotaStats.percentUsed}%)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reading History, Bookmarks & Notes Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>History, Bookmarks & Verse Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {bookmarks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Bookmarked Chapters</h4>
                <div className="flex flex-wrap gap-1.5">
                  {bookmarks.map((ref) => (
                    <Badge
                      key={ref}
                      variant="default"
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        const lastSpace = ref.lastIndexOf(' ');
                        if (lastSpace > 0) {
                          setBook(ref.slice(0, lastSpace));
                          setChapter(Number(ref.slice(lastSpace + 1)) || 1);
                          setHistoryOpen(false);
                        }
                      }}
                    >
                      {ref}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(verseNotes).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Personal Verse Notes</h4>
                <div className="space-y-1.5">
                  {Object.entries(verseNotes).map(([refKey, noteText]) => (
                    <button
                      key={refKey}
                      onClick={() => {
                        const [chapPart] = refKey.split(':');
                        const lastSpace = chapPart.lastIndexOf(' ');
                        if (lastSpace > 0) {
                          setBook(chapPart.slice(0, lastSpace));
                          setChapter(Number(chapPart.slice(lastSpace + 1)) || 1);
                          setHistoryOpen(false);
                        }
                      }}
                      className="w-full text-left p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-xs"
                    >
                      <span className="font-bold text-primary">{refKey}: </span>
                      <span className="text-muted-foreground">{noteText}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Recently Read Chapters</h4>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No chapters read yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {history.map((ref) => (
                    <Badge
                      key={ref}
                      variant="secondary"
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        const lastSpace = ref.lastIndexOf(' ');
                        if (lastSpace > 0) {
                          setBook(ref.slice(0, lastSpace));
                          setChapter(Number(ref.slice(lastSpace + 1)) || 1);
                          setHistoryOpen(false);
                        }
                      }}
                    >
                      {ref}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
