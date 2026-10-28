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
  category: string | null;
  author: string | null;
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
  if (clean === 'verseref' || clean === 'scriptureref' || clean === 'reference' || clean === 'scripture') return 'verse_ref';
  if (clean === 'versetext' || clean === 'scripturetext' || clean === 'verse') return 'verse_text';
  if (clean === 'theme' || clean === 'topic' || clean === 'category') return 'category';
  if (clean === 'content' || clean === 'reading' || clean === 'mainbody') return 'body';
  return clean;
}

/**
 * Parses devotional CSV text and validates each row according to the CMS schema.
 */
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
  const categoryIdx = headers.indexOf('category');
  const authorIdx = headers.indexOf('author');
  const statusIdx = headers.indexOf('status');

  if (titleIdx === -1 || bodyIdx === -1 || (dateIdx === -1 && !headers.includes('date'))) {
    return {
      valid: [],
      errors: [
        {
          rowNumber: 1,
          message:
            'Missing required header columns. The CSV must contain at least: date, title, verse_ref, and body.',
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
    const body = (row[bodyIdx] || '').trim();
    const category = (categoryIdx !== -1 ? row[categoryIdx] : '') || null;
    const author = (authorIdx !== -1 ? row[authorIdx] : '') || null;
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
      rawStatus.toLowerCase() === 'draft' ? 'draft' : 'published';

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
        category: category ? category.trim() : null,
        author: author ? author.trim() : null,
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
    ['date', 'title', 'verse_ref', 'verse_text', 'body', 'theme', 'author', 'status'],
    [
      formatDate(today),
      'Walking in Divine Purpose',
      'Jeremiah 29:11',
      'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
      'In our walk with God, there are moments where the path ahead seems obscured by clouds of uncertainty. We often find ourselves questioning if we are truly following His lead.\n\nBut the scriptures remind us of a fundamental truth: God\'s plans for us are intentional. He is the Great Architect of our lives. When you feel stalled, remember that preparation often looks like waiting.\n\nChoose today to trust His divine timing and stay committed to prayer and devotion.',
      'Purpose & Calling',
      'Rev. Daniel Mensah',
      'published',
    ],
    [
      formatDate(tomorrow),
      'The Shepherd Who Leads',
      'Psalm 23:1-3',
      'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.',
      'The image of the Shepherd is one of the most tender pictures of God in Scripture. A shepherd does not drive the sheep from behind with harsh commands; he leads from the front.\n\nOur Good Shepherd knows each of us by name. Green pastures and still waters speak of provision and peace found by staying near the Shepherd.',
      'Guidance & Care',
      'Pastor Grace Osei',
      'published',
    ],
    [
      formatDate(dayAfter),
      'Faith Over Fear',
      'Isaiah 41:10',
      'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.',
      'Fear is one of the enemy\'s most persistent weapons, but faith is our shield. When challenges rise against you, remember that you do not stand in your own strength.\n\nGod has promised to uphold you with His righteous right hand. Rest securely in His promise today.',
      'Faith & Victory',
      'Church Ministry',
      'published',
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
