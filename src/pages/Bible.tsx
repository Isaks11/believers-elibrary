import { useState, useEffect, useMemo } from 'react';
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

/** Built-in offline Scripture chapters (Public Domain KJV & WEB, fallback for ASV & BBE) */
const OFFLINE_CHAPTERS: Record<string, { KJV: string[]; WEB: string[] }> = {
  'Genesis 1': {
    KJV: [
      'In the beginning God created the heaven and the earth.',
      'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.',
      'And God said, Let there be light: and there was light.',
      'And God saw the light, that it was good: and God divided the light from the darkness.',
      'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.',
      'And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.',
      'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so.',
      'And God called the firmament Heaven. And the evening and the morning were the second day.',
      'And God said, Let the waters under the heaven be gathered together unto one place, and let the dry land appear: and it was so.',
      'And God called the dry land Earth; and the gathering together of the waters called he Seas: and God saw that it was good.',
    ],
    WEB: [
      'In the beginning, God created the heavens and the earth.',
      'The earth was formless and empty. Darkness was on the surface of the deep and God’s Spirit was hovering over the surface of the waters.',
      'God said, "Let there be light," and there was light.',
      'God saw the light, and saw that it was good. God divided the light from the darkness.',
      'God called the light "day", and the darkness he called "night". There was evening and there was morning, the first day.',
      'God said, "Let there be an expanse in the middle of the waters, and let it divide the waters from the waters."',
      'God made the expanse, and divided the waters which were under the expanse from the waters which were above the expanse; and it was so.',
      'God called the expanse "sky". There was evening and there was morning, a second day.',
      'God said, "Let the waters under the sky be gathered together to one place, and let the dry land appear;" and it was so.',
      'God called the dry land "earth", and the gathering together of the waters he called "seas". God saw that it was good.',
    ],
  },
  'Psalms 23': {
    KJV: [
      'The LORD is my shepherd; I shall not want.',
      'He maketh me to lie down in green pastures: he leadeth me beside the still waters.',
      'He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake.',
      'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.',
      'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.',
      'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.',
    ],
    WEB: [
      'Yahweh is my shepherd; I shall lack nothing.',
      'He makes me lie down in green pastures. He leads me beside still waters.',
      'He restores my soul. He guides me in the paths of righteousness for his name’s sake.',
      'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.',
      'You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.',
      'Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh’s house forever.',
    ],
  },
  'Proverbs 3': {
    KJV: [
      'My son, forget not my law; but let thine heart keep my commandments:',
      'For length of days, and long life, and peace, shall they add to thee.',
      'Let not mercy and truth forsake thee: bind them about thy neck; write them upon the table of thine heart:',
      'So shalt thou find favour and good understanding in the sight of God and man.',
      'Trust in the LORD with all thine heart; and lean not unto thine own understanding.',
      'In all thy ways acknowledge him, and he shall direct thy paths.',
      'Be not wise in thine own eyes: fear the LORD, and depart from evil.',
      'It shall be health to thy navel, and marrow to thy bones.',
    ],
    WEB: [
      'My son, don’t forget my teaching, but let your heart keep my commandments,',
      'for they will add to you length of days, years of life, and peace.',
      'Don’t let kindness and truth forsake you. Bind them around your neck. Write them on the tablet of your heart.',
      'So you will find favor, and good understanding in the sight of God and man.',
      'Trust in Yahweh with all your heart, and don’t lean on your own understanding.',
      'In all your ways acknowledge him, and he will make your paths straight.',
      'Don’t be wise in your own eyes. Fear Yahweh, and depart from evil.',
      'It will be health to your body, and nourishment to your bones.',
    ],
  },
  'Matthew 5': {
    KJV: [
      'And seeing the multitudes, he went up into a mountain: and when he was set, his disciples came unto him:',
      'And he opened his mouth, and taught them, saying,',
      'Blessed are the poor in spirit: for theirs is the kingdom of heaven.',
      'Blessed are they that mourn: for they shall be comforted.',
      'Blessed are the meek: for they shall inherit the earth.',
      'Blessed are they which do hunger and thirst after righteousness: for they shall be filled.',
      'Blessed are the merciful: for they shall obtain mercy.',
      'Blessed are the pure in heart: for they shall see God.',
      'Blessed are the peacemakers: for they shall be called the children of God.',
    ],
    WEB: [
      'Seeing the multitudes, he went up onto the mountain. When he had sat down, his disciples came to him.',
      'He opened his mouth and taught them, saying,',
      '"Blessed are the poor in spirit, for theirs is the Kingdom of Heaven.',
      'Blessed are those who mourn, for they shall be comforted.',
      'Blessed are the gentle, for they shall inherit the earth.',
      'Blessed are those who hunger and thirst for righteousness, for they shall be filled.',
      'Blessed are the merciful, for they shall obtain mercy.',
      'Blessed are the pure in heart, for they shall see God.',
      'Blessed are the peacemakers, for they shall be called children of God."',
    ],
  },
  'John 1': {
    KJV: [
      'In the beginning was the Word, and the Word was with God, and the Word was God.',
      'The same was in the beginning with God.',
      'All things were made by him; and without him was not any thing made that was made.',
      'In him was life; and the life was the light of men.',
      'And the light shineth in darkness; and the darkness comprehended it not.',
      'There was a man sent from God, whose name was John.',
      'The same came for a witness, to bear witness of the Light, that all men through him might believe.',
      'He was not that Light, but was sent to bear witness of that Light.',
      'That was the true Light, which lighteth every man that cometh into the world.',
    ],
    WEB: [
      'In the beginning was the Word, and the Word was with God, and the Word was God.',
      'The same was in the beginning with God.',
      'All things were made through him. Without him, nothing was made that has been made.',
      'In him was life, and the life was the light of men.',
      'The light shines in the darkness, and the darkness hasn’t overcome it.',
      'There came a man, sent from God, whose name was John.',
      'The same came as a witness, that he might testify about the light, that all might believe through him.',
      'He was not the light, but was sent that he might testify about the light.',
      'The true light that enlightens everyone was coming into the world.',
    ],
  },
  'John 3': {
    KJV: [
      'There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:',
      'The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God: for no man can do these miracles that thou doest, except God be with him.',
      'Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.',
      'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
      'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
    ],
    WEB: [
      'Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.',
      'The same came to him by night, and said to him, "Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do, unless God is with him."',
      'Jesus answered him, "Most certainly, I tell you, unless one is born anew, he can’t see the Kingdom of God."',
      'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.',
      'For God didn’t send his Son into the world to judge the world, but that the world should be saved through him.',
    ],
  },
  'Romans 8': {
    KJV: [
      'There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.',
      'For the law of the Spirit of life in Christ Jesus hath made me free from the law of sin and death.',
      'For what the law could not do, in that it was weak through the flesh, God sending his own Son in the likeness of sinful flesh, and for sin, condemned sin in the flesh:',
      'That the righteousness of the law might be fulfilled in us, who walk not after the flesh, but after the Spirit.',
      'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
      'What shall we then say to these things? If God be for us, who can be against us?',
      'Who shall separate us from the love of Christ? shall tribulation, or distress, or persecution, or famine, or nakedness, or peril, or sword?',
      'Nay, in all these things we are more than conquerors through him that loved us.',
    ],
    WEB: [
      'There is therefore now no condemnation to those who are in Christ Jesus, who don’t walk according to the flesh, but according to the Spirit.',
      'For the law of the Spirit of life in Christ Jesus made me free from the law of sin and of death.',
      'For what the law couldn’t do, in that it was weak through the flesh, God did, sending his own Son in the likeness of sinful flesh and for sin, he condemned sin in the flesh,',
      'that the ordinance of the law might be fulfilled in us, who don’t walk according to the flesh, but according to the Spirit.',
      'We know that all things work together for good for those who love God, for those who are called according to his purpose.',
      'What then shall we say about these things? If God is for us, who can be against us?',
      'Who shall separate us from the love of Christ? Could oppression, or anguish, or persecution, or famine, or nakedness, or peril, or sword?',
      'No, in all these things we are more than conquerors through him who loved us.',
    ],
  },
  'Philippians 4': {
    KJV: [
      'Rejoice in the Lord alway: and again I say, Rejoice.',
      'Let your moderation be known unto all men. The Lord is at hand.',
      'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.',
      'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.',
      'Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely, whatsoever things are of good report; if there be any virtue, and if there be any praise, think on these things.',
      'I can do all things through Christ which strengtheneth me.',
    ],
    WEB: [
      'Rejoice in the Lord always! Again I will say, "Rejoice!"',
      'Let your gentleness be known to all men. The Lord is at hand.',
      'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.',
      'And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.',
      'Finally, brothers, whatever things are true, whatever things are honorable, whatever things are just, whatever things are pure, whatever things are lovely, whatever things are of good report: if there is any virtue and if there is any praise, think about these things.',
      'I can do all things through Christ, who strengthens me.',
    ],
  },
};

const BOOKMARKS_KEY = 'bible_bookmarks';
const HIGHLIGHTS_KEY = 'bible_highlights';
const HIGHLIGHT_COLORS_KEY = 'bible_highlight_colors';
const VERSE_NOTES_KEY = 'bible_verse_notes';
const HISTORY_KEY = 'bible_history';
const CACHE_KEY = 'bible_chapter_cache';

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
  const [versionOpen, setVersionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVerseIdx, setSelectedVerseIdx] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteVerseNum, setEditingNoteVerseNum] = useState<number | null>(null);
  const [quotaStats, setQuotaStats] = useState<StorageQuotaStats | null>(null);

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

  // Record history and load chapter text (IndexedDB -> localStorage -> built-in bundle -> bible-api.com)
  useEffect(() => {
    let cancelled = false;
    const nextHistory = [chapterRef, ...loadList(HISTORY_KEY).filter((r) => r !== chapterRef)].slice(0, 35);
    saveList(HISTORY_KEY, nextHistory);
    setHistory(nextHistory);

    const loadChapter = async () => {
      // 1. Check IndexedDB / localStorage cache first
      const cachedVerses = await getOfflineBibleChapter(chapterRef, version);
      if (cancelled) return;
      if (cachedVerses && cachedVerses.length > 0) {
        const altTrans = version === 'KJV' ? 'WEB' : 'KJV';
        const altVerses = (await getOfflineBibleChapter(chapterRef, altTrans)) || cachedVerses;
        if (cancelled) return;
        setVerses(cachedVerses);
        setParallelVerses(altVerses);
        setIsOfflineCached(true);
        setLoadingChapter(false);
        return;
      }

      // 2. Check built-in offline chapters
      const offline = OFFLINE_CHAPTERS[chapterRef];
      if (offline) {
        const primary = version === 'WEB' || version === 'BBE' ? offline.WEB : offline.KJV;
        const secondary = version === 'WEB' || version === 'BBE' ? offline.KJV : offline.WEB;
        setVerses(primary);
        setParallelVerses(secondary);
        setIsOfflineCached(true);
        setLoadingChapter(false);
        return;
      }

      // 3. Fetch live from bible-api.com and persist into IndexedDB
      setIsOfflineCached(false);
      setLoadingChapter(true);
      const apiTrans = TRANSLATIONS.find((t) => t.key === version)?.apiCode || 'kjv';

      try {
        const res = await fetch(
          `https://bible-api.com/${encodeURIComponent(`${book} ${chapter}`)}?translation=${apiTrans}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data?.verses) && data.verses.length > 0) {
          const texts = data.verses.map((v: { text?: string }) => String(v.text || '').trim());
          setVerses(texts);
          setParallelVerses(texts);
          const saved = await saveOfflineBibleChapter(chapterRef, version, texts);
          if (!cancelled) {
            setIsOfflineCached(saved.ok);
            refreshQuotaStats();
          }
        } else {
          const fallback = OFFLINE_CHAPTERS['Genesis 1'];
          setVerses(fallback.KJV);
          setParallelVerses(fallback.WEB);
        }
      } catch {
        if (cancelled) return;
        const fallback = OFFLINE_CHAPTERS[chapterRef] || OFFLINE_CHAPTERS['Genesis 1'];
        setVerses(fallback.KJV);
        setParallelVerses(fallback.WEB);
        toast.error(
          navigator.onLine
            ? `Could not fetch ${chapterRef}; showing offline fallback.`
            : `Offline: ${chapterRef} was not pre-downloaded; showing Genesis 1 fallback.`
        );
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    };

    loadChapter();

    return () => {
      cancelled = true;
    };
  }, [book, chapter, version, chapterRef]);

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
                <div key={idx} className="space-y-2">
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
