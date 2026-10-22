/**
 * CMS Content Models (typed contract shared with the CMS admin UI and
 * `src/lib/contentAdmin.ts`).
 *
 * These types mirror the tables created by
 * `supabase/migrations/20261020_cms_content_and_roles.sql`:
 *   devotionals, reading_plans, hymns, videos, faith_resources,
 *   content_revisions, audit_log
 *
 * Every record carries the shared publication columns (`BaseContentRecord`):
 * draft → published (optionally scheduled) → archived workflow, a monotonic
 * `version` bumped on every edit (snapshotted into `content_revisions`),
 * tagging/category metadata and an offline-availability policy.
 */

export type ContentStatus = 'draft' | 'published' | 'archived';

export type OfflinePolicy = 'online_only' | 'optional' | 'essential';

export type ContentEntityType =
  | 'devotional'
  | 'reading_plan'
  | 'hymn'
  | 'video'
  | 'faith_resource'
  | 'library_item'
  | 'prayer_alert'
  | 'news';

/** Shared publication + provenance columns present on every CMS table. */
export interface BaseContentRecord {
  id: string;
  slug: string;
  status: ContentStatus;
  /** Set when the item went (or was scheduled and then went) live; null for drafts. */
  published_at: string | null;
  /** Future ISO timestamp while a published item is waiting to go live. */
  scheduled_for: string | null;
  version: number;
  category: string | null;
  tags: string[];
  author: string | null;
  license_attribution: string | null;
  offline_policy: OfflinePolicy;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One day/step inside a structured reading plan. */
export interface PlanStep {
  day: number;
  title: string;
  scripture_ref: string;
  reading?: string;
  reflection?: string;
}

export interface DevotionalRecord extends BaseContentRecord {
  title: string;
  body: string;
  verse_text: string | null;
  verse_ref: string;
  translation: string | null;
  /** YYYY-MM-DD the devotional is intended for (null = evergreen). */
  devotional_date: string | null;
}

export interface ReadingPlanRecord extends BaseContentRecord {
  title: string;
  description: string | null;
  days: number;
  structure: PlanStep[];
}

export interface HymnRecord extends BaseContentRecord {
  title: string;
  number: number | null;
  lyrics: string;
  audio_url: string | null;
  public_domain: boolean;
  hymn_category: string | null;
  meter: string | null;
  composer: string | null;
}

export interface VideoRecord extends BaseContentRecord {
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  speaker: string | null;
  duration_seconds: number | null;
  video_category: string | null;
}

export interface FaithResourceRecord extends BaseContentRecord {
  title: string;
  description: string | null;
  resource_url: string;
  resource_type: string | null;
  scripture_ref: string | null;
  curated_by: string | null;
}

// --- Legacy content types (managed through the CMS, but stored in the
// pre-existing library_items / prayer_alerts / news_items tables, whose schemas
// predate the publication contract — see `payloadFor` in contentAdmin.ts). ---

export type LibraryMediaType = 'book' | 'audio' | 'video' | 'material';

export interface LibraryItemCmsRecord extends BaseContentRecord {
  title: string;
  media_type: LibraryMediaType;
  description: string | null;
}

export type PrayerAlertUrgency = 'critical' | 'daily' | 'community';

export interface PrayerAlertCmsRecord extends BaseContentRecord {
  title: string;
  description: string;
  urgency: PrayerAlertUrgency;
}

export interface NewsCmsRecord extends BaseContentRecord {
  title: string;
  content: string;
  excerpt: string | null;
}

/** entityType → record shape. */
export interface ContentRecordMap {
  devotional: DevotionalRecord;
  reading_plan: ReadingPlanRecord;
  hymn: HymnRecord;
  video: VideoRecord;
  faith_resource: FaithResourceRecord;
  library_item: LibraryItemCmsRecord;
  prayer_alert: PrayerAlertCmsRecord;
  news: NewsCmsRecord;
}

export type AnyContentRecord = ContentRecordMap[ContentEntityType];

/** System/workflow fields managed by contentAdmin — never part of editor input. */
export type SystemContentFields =
  | 'id'
  | 'slug'
  | 'status'
  | 'published_at'
  | 'scheduled_for'
  | 'version'
  | 'created_by'
  | 'created_at'
  | 'updated_at';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Editor-supplied payload for create/update (system fields excluded). */
export type ContentDraft<T> = DistributiveOmit<T, SystemContentFields>;

/** Per-entity CMS metadata: table name, UI labels, local store and required fields. */
export interface ContentTypeMetaEntry {
  /** Exact PostgREST table name. */
  table: string;
  label: string;
  singularLabel: string;
  /** localStorage key following the `cms_<table>_v1` convention. */
  localStoreKey: string;
  /** Field names that must be non-empty before an item can be saved. */
  requires: string[];
}

export const ContentTypeMeta: Record<ContentEntityType, ContentTypeMetaEntry> = {
  devotional: {
    table: 'devotionals',
    label: 'Devotionals',
    singularLabel: 'Devotional',
    localStoreKey: 'cms_devotionals_v1',
    requires: ['title', 'body', 'verse_ref'],
  },
  reading_plan: {
    table: 'reading_plans',
    label: 'Reading Plans',
    singularLabel: 'Reading Plan',
    localStoreKey: 'cms_reading_plans_v1',
    requires: ['title', 'days'],
  },
  hymn: {
    table: 'hymns',
    label: 'Hymns',
    singularLabel: 'Hymn',
    localStoreKey: 'cms_hymns_v1',
    requires: ['title', 'lyrics'],
  },
  video: {
    table: 'videos',
    label: 'Videos',
    singularLabel: 'Video',
    localStoreKey: 'cms_videos_v1',
    requires: ['title', 'video_url'],
  },
  faith_resource: {
    table: 'faith_resources',
    label: 'Faith Resources',
    singularLabel: 'Faith Resource',
    localStoreKey: 'cms_faith_resources_v1',
    requires: ['title', 'resource_url'],
  },
  library_item: {
    table: 'library_items',
    label: 'Library Items',
    singularLabel: 'Library Item',
    localStoreKey: 'cms_library_items_v1',
    requires: ['title'],
  },
  prayer_alert: {
    table: 'prayer_alerts',
    label: 'Prayer Alerts',
    singularLabel: 'Prayer Alert',
    localStoreKey: 'cms_prayer_alerts_v1',
    requires: ['title'],
  },
  news: {
    table: 'news_items',
    label: 'News',
    singularLabel: 'News Item',
    localStoreKey: 'cms_news_items_v1',
    requires: ['title'],
  },
};

export const CONTENT_ENTITY_TYPES: ContentEntityType[] = [
  'devotional',
  'reading_plan',
  'hymn',
  'video',
  'faith_resource',
  'library_item',
  'prayer_alert',
  'news',
];

/** Immutable snapshot of a record version stored in `content_revisions`. */
export interface ContentRevision {
  entity_type: ContentEntityType;
  entity_id: string;
  version: number;
  snapshot: AnyContentRecord;
  edited_by: string | null;
  created_at: string;
}
