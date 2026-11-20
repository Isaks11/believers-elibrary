/**
 * CSV Parser and Template Generator for Devotionals Bulk Upload
 *
 * Implements a standards-compliant RFC 4180 CSV parser that supports
 * multi-line records, quoted strings, escaped quotes (""), and varied headers.
 */

import type { ContentStatus } from '@/types/content';

export interface ParsedDevotionalRow {
  title: string;
  devotional_date: string;
  verse_ref: string;
  verse_text: string | null;
  body: string;
  prayer: string | null;
  translation: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  license_attribution: string | null;
  offline_policy: 'online_only' | 'optional' | 'essential';
  status: ContentStatus;
}

export interface ParseDevotionalsResult {
  valid: ParsedDevotionalRow[];
  errors: { rowNumber: number; message: string }[];
  totalRows: number;
}

/**
 * Parses raw CSV text into a 2D array of strings: string[][]
 * Handles multi-line fields enclosed in quotes and escaped double quotes ("").
 */
export function parseCsvToGrid(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        // Only push row if it contains non-empty fields
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header keys to canonical property names
 */
function normalizeHeader(h: string): string {
  const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'date' || clean === 'devotionaldate') return 'devotional_date';
  if (clean === 'verseref' || clean === 'scriptureref' || clean === 'reference' || clean === 'scripture' || clean === 'scripturereference' || clean === 'biblereference' || clean === 'versereference') return 'verse_ref';
  if (clean === 'versetext' || clean === 'scripturetext' || clean === 'verse' || clean === 'scripturepassage' || clean === 'versequotation' || clean === 'bibletext') return 'verse_text';
  if (clean === 'theme' || clean === 'topic' || clean === 'category') return 'category';
  if (clean === 'content' || clean === 'reading' || clean === 'mainbody' || clean === 'devotionalbody') return 'body';
  if (clean === 'prayer' || clean === 'closingprayer' || clean === 'todaysprayer' || clean === 'devotionalprayer') return 'prayer';
  if (clean === 'bibleversion' || clean === 'version' || clean === 'translation') return 'translation';
  if (clean === 'tag' || clean === 'tags' || clean === 'keywords') return 'tags';
  if (clean === 'license' || clean === 'licence' || clean === 'attribution' || clean === 'licenseattribution') return 'license_attribution';
  if (clean === 'offline' || clean === 'offlinepolicy') return 'offline_policy';
  return clean;
}

function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeOfflinePolicy(raw: string): 'online_only' | 'optional' | 'essential' {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'essential' || v === 'required') return 'essential';
  if (v === 'optional' || v === 'cache' || v === 'cached') return 'optional';
  return 'online_only';
}

/**
 * Parses devotional CSV text and validates each row according to the CMS schema.
 */
export function normalizeParagraphText(raw: string): string {
  const normalized = raw
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]*\n+/g, '\n\n')
    .trim();
  if (!normalized) return '';
  // If copied/pasted text uses single newlines between paragraphs (no blank lines),
  // promote each line break to a paragraph break (\n\n).
  if (!/\n\s*\n/.test(normalized) && normalized.includes('\n')) {
    return normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n\n');
  }
  return normalized;
}

export function splitDevotionalParagraphs(raw: string): string[] {
  const normalized = (raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  if (/\n\s*\n/.test(normalized)) {
    return normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  }
  return normalized.split('\n').map((p) => p.trim()).filter(Boolean);
}

export function normalizeTranslation(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return null;
  return trimmed;
}

export function parseDevotionalsCsv(csvText: string): ParseDevotionalsResult {
  const grid = parseCsvToGrid(csvText);
  if (grid.length === 0) {
    return { valid: [], errors: [{ rowNumber: 0, message: 'CSV file is empty.' }], totalRows: 0 };
  }

  const rawHeaders = grid[0];
  const headers = rawHeaders.map(normalizeHeader);

  const titleIdx = headers.indexOf('title');
  const dateIdx = headers.indexOf('devotional_date');
  const verseRefIdx = headers.indexOf('verse_ref');
  const verseTextIdx = headers.indexOf('verse_text');
  const bodyIdx = headers.indexOf('body');
  const prayerIdx = headers.indexOf('prayer');
  const translationIdx = headers.indexOf('translation');
  const categoryIdx = headers.indexOf('category');
  const tagsIdx = headers.indexOf('tags');
  const authorIdx = headers.indexOf('author');
  const licenseIdx = headers.indexOf('license_attribution');
  const offlineIdx = headers.indexOf('offline_policy');
  const statusIdx = headers.indexOf('status');

  if (titleIdx === -1 || bodyIdx === -1 || dateIdx === -1 || verseRefIdx === -1) {
    return {
      valid: [],
      errors: [
        {
          rowNumber: 1,
          message:
            'Missing required columns. CSV must include: date (or devotional_date), title, verse_ref, and body. Optional: verse_text, prayer, translation, category, tags, author, license_attribution, offline_policy, status.',
        },
      ],
      totalRows: 0,
    };
  }

  const valid: ParsedDevotionalRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];
  const dataRows = grid.slice(1);

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, accounting for header
    const title = (row[titleIdx] || '').trim();
    const rawDate = (row[dateIdx] || '').trim();
    const verseRef = (verseRefIdx !== -1 ? row[verseRefIdx] : '') || '';
    const verseText = (verseTextIdx !== -1 ? row[verseTextIdx] : '') || null;
    const body = normalizeParagraphText(row[bodyIdx] || '');
    const rawPrayer = (prayerIdx !== -1 ? row[prayerIdx] : '') || '';
    const prayer = rawPrayer.trim() ? normalizeParagraphText(rawPrayer) : null;
    const translation = normalizeTranslation((translationIdx !== -1 ? row[translationIdx] : '') || '');
    const category = (categoryIdx !== -1 ? row[categoryIdx] : '') || null;
    const tagsRaw = (tagsIdx !== -1 ? row[tagsIdx] : '') || '';
    const author = (authorIdx !== -1 ? row[authorIdx] : '') || null;
    const licenseAttribution = (licenseIdx !== -1 ? row[licenseIdx] : '') || null;
    const offlineRaw = (offlineIdx !== -1 ? row[offlineIdx] : '') || 'optional';
    const rawStatus = (statusIdx !== -1 ? row[statusIdx] : 'published') || 'published';

    const rowErrors: string[] = [];

    if (!title) rowErrors.push('Title is required');
    if (!body) rowErrors.push('Body content is required');

    // Date validation: YYYY-MM-DD
    let cleanDate = rawDate;
    if (!cleanDate) {
      rowErrors.push('Date is required (YYYY-MM-DD)');
    } else {
      // Support slash dates like YYYY/MM/DD or MM/DD/YYYY if possible
      const isoMatch = cleanDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (isoMatch) {
        const y = isoMatch[1];
        const m = isoMatch[2].padStart(2, '0');
        const d = isoMatch[3].padStart(2, '0');
        cleanDate = `${y}-${m}-${d}`;
      } else {
        const parsedMs = Date.parse(cleanDate);
        if (Number.isFinite(parsedMs)) {
          const dObj = new Date(parsedMs);
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          cleanDate = `${y}-${m}-${d}`;
        } else {
          rowErrors.push(`Invalid date format "${rawDate}". Use YYYY-MM-DD`);
        }
      }
    }

    if (!verseRef) {
      rowErrors.push('Verse reference is required (e.g. John 3:16)');
    }

    const status: ContentStatus =
      rawStatus.trim().toLowerCase() === 'draft' ? 'draft' : 'published';

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber: rowNum,
        message: rowErrors.join(', '),
      });
    } else {
      valid.push({
        title,
        devotional_date: cleanDate,
        verse_ref: verseRef.trim(),
        verse_text: verseText ? verseText.trim() : null,
        body,
        prayer: prayer ? prayer.trim() : null,
        translation: translation ? translation.trim() : null,
        category: category ? category.trim() : null,
        tags: parseTags(tagsRaw),
        author: author ? author.trim() : null,
        license_attribution: licenseAttribution ? licenseAttribution.trim() : null,
        offline_policy: normalizeOfflinePolicy(offlineRaw),
        status,
      });
    }
  });

  return {
    valid,
    errors,
    totalRows: dataRows.length,
  };
}

/**
 * Generates an RFC 4180 compliant CSV template for downloading.
 */
export function generateDevotionalsTemplateCsv(): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 86400000 * 2);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const rows = [
    [
      'date',
      'title',
      'verse_ref',
      'verse_text',
      'body',
      'prayer',
      'translation',
      'category',
      'tags',
      'author',
      'license_attribution',
      'offline_policy',
      'status',
    ],
    [
      formatDate(today),
      'Walking in Divine Purpose',
      'Jeremiah 29:11',
      'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
      'In our walk with God, there are moments where the path ahead seems obscured by clouds of uncertainty.\n\nBut Scripture reminds us that God’s plans are intentional. When you feel stalled, preparation often looks like waiting.\n\nChoose today to trust His divine timing and stay committed to prayer and devotion.',
      'Lord, thank You for Your plans and purpose for my life. Help me to trust Your timing, walk in obedience, and rest in Your promises today. Amen.',
      'KJV',
      'Purpose & Calling',
      'purpose; trust; guidance',
      'Rev. Daniel Mensah',
      'Believers e-Library / Ministry content',
      'optional',
      'published',
    ],
    [
      formatDate(tomorrow),
      'The Shepherd Who Leads',
      'Psalm 23:1-3',
      'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.',
      'The image of the Shepherd is one of the most tender pictures of God in Scripture. A shepherd leads from the front and knows each sheep by name.\n\nGreen pastures and still waters speak of provision and peace found by staying near the Shepherd. Rest in His care today.',
      'Good Shepherd, thank You for guiding and restoring my soul. Lead me in Your paths today and help me to follow Your voice with peace and confidence. Amen.',
      'KJV',
      'Guidance & Care',
      'shepherd; peace; provision',
      'Pastor Grace Osei',
      'Public domain scripture quotation noted where applicable',
      'optional',
      'published',
    ],
    [
      formatDate(dayAfter),
      'Faith Over Fear',
      'Isaiah 41:10',
      'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.',
      'Fear is a persistent weapon, but faith is our shield. When challenges rise, remember that you do not stand in your own strength.\n\nGod has promised to uphold you with His righteous right hand. Rest securely in His promise today.',
      'Father God, when fear rises, remind me that You are with me. Strengthen my heart, calm my mind, and help me to trust You in every situation. Amen.',
      'KJV',
      'Faith & Victory',
      'faith; courage; strength',
      'Church Ministry',
      '',
      'online_only',
      'draft',
    ],
  ];

  return rows
    .map((row) =>
      row
        .map((field) => {
          const str = String(field);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\r\n');
}
