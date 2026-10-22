/**
 * Community Fellowship, Prayer Sharing & Safeguarding Service (Phase 3 — Stage 3)
 *
 * Security & Safeguarding Architecture:
 * 1. Honest Backend Disclosure: When `isRemoteConfigured` is false, all community features
 *    are explicitly labelled as a "Local Device Prototype" so users never assume local storage
 *    provides multi-user communication or server-enforced moderation.
 * 2. Server-Side Authorization: When Supabase is configured, writes and moderation actions
 *    execute against PostgreSQL tables protected by Row Level Security (`public.is_admin()`).
 *    Frontend role checks are UX guards only and never treated as security boundaries.
 * 3. Privacy Controls for Prayer Sharing:
 *    - `private_only`: Saved strictly to the user's private Prayer List (`journalData`), never shared.
 *    - `group_only`: Shared only inside the chosen Fellowship Group view.
 *    - `community_public`: Shared on the main Community Feed (with optional anonymous attribution).
 * 4. Rate Limiting & Content Safeguarding:
 *    - Enforces a minimum cooldown between posts/comments per user to prevent spam.
 *    - Blocks abusive/profane or scam links before submission.
 * 5. Reporting, User Blocking & Moderation Queue:
 *    - Users can report any post or comment with a reason (`harassment`, `false_teaching_spam`,
 *      `privacy_violation`, `scam_solicitation`, `other`) and block specific authors.
 *    - Reported items enter the Moderation Queue (`pending` -> `approved_safe` | `removed`).
 */

import { supabase, isSupabaseConfigured as isRemoteConfigured } from '@/lib/supabase';
import { addPersonalPrayer } from '@/data/journalData';
import { recordWriteOutcome, recordWriteError, recordSyncFailure, clearSyncFailure } from '@/lib/syncHealth';

/** UUID-shaped id for local posts/comments (server PKs are uuid — a non-UUID id would fail to upsert). */
function makeLocalId(): string {
  const hex = '0123456789abcdef';
  const rand = (n: number) =>
    Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
  return `${rand(8)}-${rand(4)}-4${rand(3)}-a${rand(3)}-${rand(12)}`;
}

export type PostPrivacyScope = 'private_only' | 'group_only' | 'community_public';
export type PostCategory = 'testimony' | 'scripture_reflection' | 'prayer_request' | 'question';
export type ReportReason =
  | 'harassment'
  | 'false_teaching_spam'
  | 'privacy_violation'
  | 'scam_solicitation'
  | 'other';

export interface CommunityGroup {
  id: number;
  name: string;
  members: number;
  description: string;
  verifiedMinistry?: string;
}

export interface PostComment {
  id: string;
  authorId: string;
  author: string;
  text: string;
  createdAt: string;
  moderationStatus?: 'active' | 'flagged' | 'removed';
}

export interface CommunityPost {
  id: string;
  authorId: string;
  author: string;
  isAnonymous?: boolean;
  badge: string;
  groupName: string;
  category: PostCategory;
  privacyScope: PostPrivacyScope;
  scriptureRef?: string;
  body: string;
  likes: number;
  likedByMe: boolean;
  prayedCount: number;
  prayedByMe: boolean;
  comments: PostComment[];
  moderationStatus: 'active' | 'flagged' | 'removed';
  createdAt: string;
}

export interface ModerationReport {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  postId: string;
  targetSnippet: string;
  targetAuthor: string;
  reporterEmail: string;
  reason: ReportReason;
  details: string;
  status: 'pending' | 'resolved_removed' | 'resolved_dismissed';
  createdAt: string;
}

export const COMMUNITY_RULES: { title: string; description: string }[] = [
  {
    title: '1. Speak the Truth in Love (Ephesians 4:15)',
    description:
      'Engage fellow believers with humility, gentleness, and respect. Personal attacks, harassment, or sectarian hostility are not permitted.',
  },
  {
    title: '2. Protect Personal & Family Privacy',
    description:
      'Never post another person’s private medical, financial, or family details without explicit permission. Use anonymous prayer sharing for sensitive needs.',
  },
  {
    title: '3. No Financial Solicitation orScams',
    description:
      'Do not use fellowship groups or prayer feeds to solicit money, promote commercial schemes, or post external fundraising links.',
  },
  {
    title: '4. Honor Scripture & Charitable Orthodoxy',
    description:
      'Distinguish clearly between direct Scripture and personal opinion. Respect secondary denominational differences among believers.',
  },
];

export const FELLOWSHIP_GROUPS: CommunityGroup[] = [
  {
    id: 1,
    name: 'Morning Prayer Warriors',
    members: 1250,
    description: 'Interceding for families, churches, and nations every sunrise.',
    verifiedMinistry: 'Intercessory Prayer Network',
  },
  {
    id: 2,
    name: 'Youth Bible Study',
    members: 840,
    description: 'Exploring Scripture, apologetics, and Christian living together.',
    verifiedMinistry: 'GBE Youth Fellowship',
  },
  {
    id: 3,
    name: 'Mothers of Faith',
    members: 2100,
    description: 'Encouraging mothers and caregivers in prayer and biblical wisdom.',
    verifiedMinistry: 'Women of Grace Ministry',
  },
  {
    id: 4,
    name: 'Men of Valor Fellowship',
    members: 620,
    description: 'Equipping brothers in Christ to lead with integrity, service, and humility.',
    verifiedMinistry: 'Men’s Discipleship Alliance',
  },
];

export const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post-1',
    authorId: 'sample-sarah',
    author: 'Sarah Jenkins',
    badge: 'Prayer Warrior',
    groupName: 'Morning Prayer Warriors',
    category: 'testimony',
    privacyScope: 'community_public',
    scriptureRef: 'Psalms 30:2',
    body: 'Thank You Lord for another morning of grace! My heart is full of gratitude for the recovery my family experienced this week. Thank you to everyone who prayed with us.',
    likes: 14,
    likedByMe: false,
    prayedCount: 22,
    prayedByMe: false,
    comments: [
      {
        id: 'c-1',
        authorId: 'sample-david',
        author: 'Brother David',
        text: 'Amen! Rejoicing with your family today.',
        createdAt: '1h ago',
        moderationStatus: 'active',
      },
    ],
    moderationStatus: 'active',
    createdAt: '2 hours ago',
  },
  {
    id: 'post-2',
    authorId: 'sample-emmanuel',
    author: 'Pastor Emmanuel',
    badge: 'Verified Ministry Leader',
    groupName: 'Youth Bible Study',
    category: 'scripture_reflection',
    privacyScope: 'community_public',
    scriptureRef: 'Romans 8:1',
    body: 'As we meditate on Romans 8 this week, remember: there is therefore now no condemnation to those who are in Christ Jesus. Walk in freedom and holiness today!',
    likes: 19,
    likedByMe: false,
    prayedCount: 9,
    prayedByMe: false,
    comments: [],
    moderationStatus: 'active',
    createdAt: '5 hours ago',
  },
];

const POSTS_KEY = 'community_posts_v2';
const JOINED_GROUPS_KEY = 'community_joined_groups_v1';
const BLOCKED_AUTHORS_KEY = 'community_blocked_authors_v1';
const REPORTS_KEY = 'community_moderation_reports_v1';
const RATE_LIMIT_KEY = 'community_last_action_ts_v1';

const RATE_LIMIT_COOLDOWN_MS = 10_000; // 10 seconds between posts/comments per user

const PROHIBITED_PATTERNS = [
  /\b(send\s+money|wire\s+transfer|crypto\s+giveaway|whatsapp\s+\+?\d{6,})\b/i,
  /\b(hate\s+you|kill\s+yourself|idiot\s+believer)\b/i,
];

export function validateCommunityContent(text: string): { valid: boolean; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length < 3) {
    return { valid: false, reason: 'Message is too short (minimum 3 characters).' };
  }
  if (trimmed.length > 2000) {
    return { valid: false, reason: 'Message exceeds maximum length (2,000 characters).' };
  }
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason:
          'Message triggered community safeguarding filters (financial solicitation or abusive language is not permitted).',
      };
    }
  }
  return { valid: true };
}

export function checkAndRecordRateLimit(
  userIdOrEmail: string,
  nowMs: number = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const lastTs = map[userIdOrEmail] || 0;
    const elapsed = nowMs - lastTs;
    if (elapsed < RATE_LIMIT_COOLDOWN_MS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((RATE_LIMIT_COOLDOWN_MS - elapsed) / 1000),
      };
    }
    map[userIdOrEmail] = nowMs;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(map));
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function getCommunityPosts(): CommunityPost[] {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    if (!raw) return INITIAL_COMMUNITY_POSTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_COMMUNITY_POSTS;
  } catch {
    return INITIAL_COMMUNITY_POSTS;
  }
}

export function saveCommunityPosts(posts: CommunityPost[]): void {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch {
    /* ignore */
  }
}

export function getJoinedGroups(): number[] {
  try {
    const raw = localStorage.getItem(JOINED_GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveJoinedGroups(ids: number[]): void {
  try {
    localStorage.setItem(JOINED_GROUPS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }

  if (isRemoteConfigured && supabase) {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      const selectedGroups = FELLOWSHIP_GROUPS.filter((g) => ids.includes(g.id));
      for (const g of selectedGroups) {
        try {
          const res = await supabase.from('community_group_members').upsert({
            user_id: uid,
            group_id: g.id,
            group_name: g.name,
          });
          recordWriteOutcome('community', res);
        } catch (err) {
          recordWriteError('community', err);
        }
      }
    });
  }
}

export function getBlockedAuthors(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_AUTHORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleBlockAuthor(authorNameOrId: string): { blocked: boolean; list: string[] } {
  const current = getBlockedAuthors();
  const exists = current.includes(authorNameOrId);
  const next = exists ? current.filter((a) => a !== authorNameOrId) : [...current, authorNameOrId];
  try {
    localStorage.setItem(BLOCKED_AUTHORS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }

  if (isRemoteConfigured && supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      if (!exists) {
        supabase
          .from('user_blocks')
          .upsert({ blocker_id: uid, blocked_ref: authorNameOrId })
          .then((res) => recordWriteOutcome('community', res), (err) => recordWriteError('community', err));
      } else {
        supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', uid)
          .eq('blocked_ref', authorNameOrId)
          .then((res) => recordWriteOutcome('community', res), (err) => recordWriteError('community', err));
      }
    });
  }

  return { blocked: !exists, list: next };
}

export function getModerationReports(): ModerationReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveModerationReports(reports: ModerationReport[]): void {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    /* ignore */
  }
}

export function submitCommunityReport(input: {
  targetType: 'post' | 'comment';
  targetId: string;
  postId: string;
  targetSnippet: string;
  targetAuthor: string;
  reporterEmail: string;
  reason: ReportReason;
  details: string;
}): ModerationReport {
  const report: ModerationReport = {
    id: `rep-${Date.now()}`,
    targetType: input.targetType,
    targetId: input.targetId,
    postId: input.postId,
    targetSnippet: input.targetSnippet.slice(0, 180),
    targetAuthor: input.targetAuthor,
    reporterEmail: input.reporterEmail,
    reason: input.reason,
    details: input.details.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const reports = [report, ...getModerationReports()];
  saveModerationReports(reports);

  // Mark post as flagged for review
  const posts = getCommunityPosts().map((p) => {
    if (p.id !== input.postId) return p;
    if (input.targetType === 'post') {
      return { ...p, moderationStatus: 'flagged' as const };
    }
    return {
      ...p,
      comments: p.comments.map((c) =>
        c.id === input.targetId ? { ...c, moderationStatus: 'flagged' as const } : c
      ),
    };
  });
  saveCommunityPosts(posts);

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase
        .from('community_reports')
        .insert({
          target_type: report.targetType,
          target_id: report.targetId,
          post_id: report.postId,
          reason: report.reason,
          details: report.details,
          reported_by: uid,
        })
        .then((res) => recordWriteOutcome('community', res), (err) => recordWriteError('community', err));
    });
  }

  return report;
}

/**
 * Resolves a moderation report.
 * Requires admin role verification; when Supabase is configured, also enforces server-side RLS check.
 */
export async function resolveModerationReport(
  reportId: string,
  decision: 'resolved_removed' | 'resolved_dismissed',
  actorRole?: 'user' | 'admin'
): Promise<{ ok: boolean; error?: string; reports: ModerationReport[]; posts: CommunityPost[] }> {
  if (actorRole !== 'admin') {
    return {
      ok: false,
      error: 'Unauthorized: Administrator permissions are required to resolve moderation reports.',
      reports: getModerationReports(),
      posts: getCommunityPosts(),
    };
  }

  const reports = getModerationReports();
  const targetReport = reports.find((r) => r.id === reportId);

  // If Supabase backend is active, verify server-side admin profile role before mutating
  if (isRemoteConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        return {
          ok: false,
          error: 'Unauthorized: Active server session required.',
          reports: getModerationReports(),
          posts: getCommunityPosts(),
        };
      }
      const { data: prof, error: profErr } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
      if (profErr) {
        // Fail closed: never claim a moderation decision succeeded when the
        // server-side admin check itself could not be completed.
        return {
          ok: false,
          error: `Server authorization check failed: ${profErr.message}`,
          reports: getModerationReports(),
          posts: getCommunityPosts(),
        };
      }
      if (!prof || prof.role !== 'admin') {
        return {
          ok: false,
          error: 'Server authorization denied: Admin role required by RLS policy.',
          reports: getModerationReports(),
          posts: getCommunityPosts(),
        };
      }

      const updErrors: string[] = [];
      const upd1 = await supabase.from('community_reports').update({ status: decision }).eq('id', reportId);
      if (upd1.error) updErrors.push(`report: ${upd1.error.message}`);
      if (targetReport) {
        const nextStatus = decision === 'resolved_removed' ? 'removed' : 'active';
        if (targetReport.targetType === 'post') {
          const upd2 = await supabase
            .from('community_posts')
            .update({ moderation_status: nextStatus })
            .eq('id', targetReport.postId);
          if (upd2.error) updErrors.push(`post: ${upd2.error.message}`);
        } else {
          const upd3 = await supabase
            .from('community_comments')
            .update({ moderation_status: nextStatus })
            .eq('id', targetReport.targetId);
          if (upd3.error) updErrors.push(`comment: ${upd3.error.message}`);
        }
      }
      if (updErrors.length > 0) {
        return {
          ok: false,
          error: `Server rejected the moderation action (${updErrors.join('; ')}). Nothing was changed.`,
          reports: getModerationReports(),
          posts: getCommunityPosts(),
        };
      }
    } catch (err) {
      return {
        ok: false,
        error: `Could not reach the server to verify admin permissions: ${
          err instanceof Error ? err.message : 'network unavailable'
        }. Moderation requires the backend.`,
        reports: getModerationReports(),
        posts: getCommunityPosts(),
      };
    }
  }

  const updatedReports = reports.map((r) => (r.id === reportId ? { ...r, status: decision } : r));
  saveModerationReports(updatedReports);

  let posts = getCommunityPosts();
  if (targetReport) {
    posts = posts.map((p) => {
      if (p.id !== targetReport.postId) return p;
      if (targetReport.targetType === 'post') {
        return {
          ...p,
          moderationStatus: decision === 'resolved_removed' ? 'removed' : 'active',
        };
      }
      return {
        ...p,
        comments: p.comments.map((c) =>
          c.id === targetReport.targetId
            ? { ...c, moderationStatus: decision === 'resolved_removed' ? 'removed' : 'active' }
            : c
        ),
      };
    });
    saveCommunityPosts(posts);
  }

  return { ok: true, reports: updatedReports, posts };
}

/**
 * Creates a community post or routes a private prayer request to the user's private journal.
 */
export function createCommunityOrPrayerPost(input: {
  authorId: string;
  authorName: string;
  authorRole?: 'user' | 'admin';
  isAnonymous: boolean;
  groupName: string;
  category: PostCategory;
  privacyScope: PostPrivacyScope;
  scriptureRef?: string;
  body: string;
}): {
  ok: boolean;
  routedToPrivateJournal?: boolean;
  error?: string;
  post?: CommunityPost;
} {
  const validation = validateCommunityContent(input.body);
  if (!validation.valid) {
    return { ok: false, error: validation.reason };
  }

  const rateCheck = checkAndRecordRateLimit(input.authorId);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      error: `Please wait ${rateCheck.retryAfterSeconds}s before posting again (community rate limit).`,
    };
  }

  // If user selected private_only, save directly to their private Prayer List and never publish to community
  if (input.privacyScope === 'private_only') {
    addPersonalPrayer({
      title: input.body.slice(0, 60),
      body: input.body,
      category: 'Personal',
      scriptureRef: input.scriptureRef,
    });
    return { ok: true, routedToPrivateJournal: true };
  }

  // UX guard: group_only posts may only target a group the user actually joined.
  // (Server RLS is the security boundary; this prevents obviously-failing writes.)
  if (input.privacyScope === 'group_only') {
    const groupObj = FELLOWSHIP_GROUPS.find((g) => g.name === input.groupName);
    const joined = groupObj ? getJoinedGroups().includes(groupObj.id) : false;
    if (!joined && input.authorRole !== 'admin') {
      return {
        ok: false,
        error: `Join "${input.groupName}" first before sharing with that group.`,
      };
    }
  }

  const displayAuthor = input.isAnonymous ? 'Anonymous Believer' : input.authorName || 'Believer';
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : makeLocalId();

  const post: CommunityPost = {
    id,
    authorId: input.isAnonymous ? 'anonymous' : input.authorId,
    author: displayAuthor,
    isAnonymous: input.isAnonymous,
    badge: input.authorRole === 'admin' ? 'Ministry Moderator' : 'Fellowship Member',
    groupName: input.groupName,
    category: input.category,
    privacyScope: input.privacyScope,
    scriptureRef: input.scriptureRef?.trim() || undefined,
    body: input.body.trim(),
    likes: 0,
    likedByMe: false,
    prayedCount: 0,
    prayedByMe: false,
    comments: [],
    moderationStatus: 'active',
    createdAt: 'Just now',
  };

  const next = [post, ...getCommunityPosts()];
  saveCommunityPosts(next);

  if (isRemoteConfigured && supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase
        .from('community_posts')
        .upsert({
          id: post.id,
          author_id: uid,
          author_name: displayAuthor,
          is_anonymous: Boolean(input.isAnonymous),
          group_name: post.groupName,
          category: post.category,
          privacy_scope: post.privacyScope,
          scripture_ref: post.scriptureRef ?? null,
          body: post.body,
          moderation_status: 'active',
        })
        .then((res) => recordWriteOutcome('community', res), (err) => recordWriteError('community', err));
    });
  }

  return { ok: true, post };
}

/**
 * Pushes a new comment to `community_comments` when the backend is available.
 * Failures are recorded in sync health — callers show "posted" only for local state.
 */
export function pushCommunityComment(input: {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
}): void {
  if (!isRemoteConfigured || !supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user?.id;
    if (!uid || !supabase) return;
    supabase
      .from('community_comments')
      .insert({
        // Push the same uuid the local copy uses so the next pull merges
        // instead of duplicating the comment.
        id: input.id,
        post_id: input.postId,
        author_id: uid,
        author_name: input.authorName,
        body: input.body,
        moderation_status: 'active',
      })
      .then((res) => recordWriteOutcome('community', res), (err) => recordWriteError('community', err));
  });
}

/**
 * Synchronizes community posts, comments, blocks, and group memberships from Supabase when configured.
 */
export async function syncCommunityDataFromServer(): Promise<{
  posts: CommunityPost[];
  blockedAuthors: string[];
  joinedGroups: number[];
  /** Set when any server read failed — callers must NOT report success. */
  error?: string;
}> {
  if (!isRemoteConfigured || !supabase) {
    return {
      posts: getCommunityPosts(),
      blockedAuthors: getBlockedAuthors(),
      joinedGroups: getJoinedGroups(),
    };
  }

  const pullErrors: string[] = [];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      return {
        posts: getCommunityPosts(),
        blockedAuthors: getBlockedAuthors(),
        joinedGroups: getJoinedGroups(),
      };
    }

    const [postsRes, commentsRes, blocksRes, groupsRes] = await Promise.all([
      supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('community_comments').select('*').order('created_at', { ascending: true }),
      supabase.from('user_blocks').select('*').eq('blocker_id', uid),
      supabase.from('community_group_members').select('*').eq('user_id', uid),
    ]);

    if (postsRes.error) pullErrors.push(`posts: ${postsRes.error.message}`);
    if (commentsRes.error) pullErrors.push(`comments: ${commentsRes.error.message}`);
    if (blocksRes.error) pullErrors.push(`blocks: ${blocksRes.error.message}`);
    if (groupsRes.error) pullErrors.push(`groups: ${groupsRes.error.message}`);

    if (!blocksRes.error && blocksRes.data) {
      const mergedBlocks = Array.from(
        new Set([...getBlockedAuthors(), ...blocksRes.data.map((b: Record<string, unknown>) => String(b.blocked_ref))])
      );
      localStorage.setItem(BLOCKED_AUTHORS_KEY, JSON.stringify(mergedBlocks));
    }

    if (!groupsRes.error && groupsRes.data) {
      const mergedGroups = Array.from(
        new Set([...getJoinedGroups(), ...groupsRes.data.map((g: Record<string, unknown>) => Number(g.group_id))])
      );
      localStorage.setItem(JOINED_GROUPS_KEY, JSON.stringify(mergedGroups));
    }

    if (!postsRes.error && postsRes.data && postsRes.data.length > 0) {
      const commentsByPost = new Map<string, PostComment[]>();
      if (!commentsRes.error && commentsRes.data) {
        for (const c of commentsRes.data as Array<Record<string, unknown>>) {
          const pid = String(c.post_id);
          const list = commentsByPost.get(pid) || [];
          list.push({
            id: String(c.id),
            authorId: String(c.author_id),
            author: String(c.author_name || 'Believer'),
            text: String(c.body || ''),
            createdAt: String(c.created_at || '').slice(0, 10),
            moderationStatus: (c.moderation_status as 'active' | 'flagged' | 'removed') || 'active',
          });
          commentsByPost.set(pid, list);
        }
      }

      const remotePosts: CommunityPost[] = (postsRes.data as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        authorId: r.is_anonymous ? 'anonymous' : String(r.author_id),
        author: r.is_anonymous ? 'Anonymous Believer' : String(r.author_name || 'Believer'),
        isAnonymous: Boolean(r.is_anonymous),
        badge: 'Fellowship Member',
        groupName: String(r.group_name || 'Morning Prayer Warriors'),
        category: (r.category as PostCategory) || 'testimony',
        privacyScope: (r.privacy_scope as PostPrivacyScope) || 'community_public',
        scriptureRef: r.scripture_ref ? String(r.scripture_ref) : undefined,
        body: String(r.body || ''),
        likes: 0,
        likedByMe: false,
        prayedCount: 0,
        prayedByMe: false,
        comments: commentsByPost.get(String(r.id)) || [],
        moderationStatus: (r.moderation_status as 'active' | 'flagged' | 'removed') || 'active',
        createdAt: String(r.created_at || '').slice(0, 10),
      }));

      const byId = new Map<string, CommunityPost>();
      getCommunityPosts().forEach((p) => byId.set(p.id, p));
      remotePosts.forEach((p) => {
        const local = byId.get(p.id);
        // Preserve local-only comments (e.g. created offline) while remote
        // comments win on id conflicts — server copy is authoritative.
        const localOnly = local
          ? local.comments.filter((c) => !p.comments.some((rc) => rc.id === c.id))
          : [];
        byId.set(p.id, { ...local, ...p, comments: [...localOnly, ...p.comments] });
      });
      saveCommunityPosts(Array.from(byId.values()));
    }
  } catch (err) {
    pullErrors.push(err instanceof Error ? err.message : 'network unavailable');
  }

  const error = pullErrors.length > 0 ? pullErrors.join('; ') : undefined;
  if (error) {
    recordSyncFailure('community', error);
  } else {
    clearSyncFailure('community');
  }

  return {
    posts: getCommunityPosts(),
    blockedAuthors: getBlockedAuthors(),
    joinedGroups: getJoinedGroups(),
    ...(error ? { error } : {}),
  };
}

