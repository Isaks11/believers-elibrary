import { LibraryItem, PrayerAlert, NewsItem, UserStats, MediaType, UrgencyLevel, NewsCategory, AlertStatus } from '@/types/library-news'
import { supabase } from '@/lib/supabase'
import { recordSyncFailure, clearSyncFailure, recordWriteOutcome, recordWriteError, trackServerWrite } from '@/lib/syncHealth'
import { getCompletedDevotionalMap, saveCompletedDevotionalMap } from '@/data/mockDevotionalHymnData'

const STORAGE_KEYS = {
  library: 'faith_library_items_v3',
  libraryProgress: 'faith_library_progress',
  prayers: 'faith_prayer_alerts_v2',
  prayerInteractions: 'faith_prayer_interactions',
  news: 'faith_news_items_v2',
  stats: 'faith_user_stats_v2',
}

export const initialLibraryItems: LibraryItem[] = [
  {
    id: 'lib-1',
    title: 'The Pursuit of God (Complete Classic Edition)',
    author: 'A.W. Tozer',
    publisher: 'Christian Publications (1948)',
    license: 'Public Domain — Unencumbered Christian Classic',
    type: 'book',
    category: 'Spiritual Growth',
    description:
      'A timeless devotional classic calling believers beyond outward religion into deep, personal communion with the living God.',
    pages: 128,
    featured: true,
    approvalStatus: 'approved',
    uploadedAt: '2024-01-15',
    content:
      'Before the Lord God made man upon the earth He first prepared for him a world of useful and pleasant things for his sustenance and delight. God’s deepest desire is that we know Him personally in spirit and truth.',
    chapters: [
      {
        title: 'Chapter 1: Following Hard After God',
        content:
          '"My soul followeth hard after thee: thy right hand upholdeth me." (Psalm 63:8)\n\nChristian theology teaches the doctrine of prevenient grace, which briefly stated means this: that before a man can seek God, God must first have sought the man.\n\nBefore a sinful man can think a right thought of God, there must have been a work of enlightenment done within him; imperfect it may be, but a true work nonetheless, and the secret cause of all desiring and seeking and praying which may follow.\n\nWe pursue God because, and only because, He has first put an urge within us that spurs us to the pursuit. "No man can come to me," said our Lord, "except the Father which hath sent me draw him," and it is by this very prevenient drawing that God takes from us every vestige of credit for the act of coming.',
      },
      {
        title: 'Chapter 2: The Blessedness of Possessing Nothing',
        content:
          '"Blessed are the poor in spirit: for theirs is the kingdom of heaven." (Matthew 5:3)\n\nBefore the Lord God made man upon the earth He first prepared for him a world of useful and pleasant things for his sustenance and delight. In the Genesis account of the creation these are called simply "things." They were made for man’s uses, but they were meant always to be external to the man and subservient to him.\n\nIn the deep heart of the man was a shrine where none but God was worthy to come. Within him was God; without, a thousand gifts which God had showered upon him.\n\nTrue spiritual freedom begins when we surrender ownership of everything back into the hands of the Father.',
      },
      {
        title: 'Chapter 3: Removing the Veil',
        content:
          '"Having therefore, brethren, boldness to enter into the holiest by the blood of Jesus." (Hebrews 10:19)\n\nSpiritual reality is not distant. Through the finished work of Christ on the cross, the veil separating humanity from the Holy of Holies was torn from top to bottom.\n\nGod invites every believer not merely to study doctrines about Him, but to enter consciously into His presence with confidence, humility, and adoring love.',
      },
    ],
  },
  {
    id: 'lib-2',
    title: 'Walking in Faith Sunday Sermon',
    author: 'Pastor James Mitchell',
    publisher: 'Believers Fellowship Pulpit',
    license: 'Creative Commons Attribution (CC BY-NC 4.0) — Approved Ministry Recording',
    type: 'audio',
    category: 'Sermons',
    description:
      "A powerful spoken message about stepping out of your comfort zone and trusting God's promises when the path ahead is unseen.",
    duration: '12:40',
    featured: true,
    approvalStatus: 'approved',
    uploadedAt: '2024-03-20',
    content:
      'Grace and peace to you in the name of our Lord Jesus Christ. Today we open Hebrews chapter 11, verse 1: Now faith is the substance of things hoped for, the evidence of things not seen. When God called Abraham out of Ur, He did not hand Abraham a detailed ten-year map. He gave Abraham His Word and His presence. Walking by faith means taking the next obedient step today because you trust the character of the One who called you. Let us pray together: Father, grant us courage to obey Your voice even before we see the outcome. In Jesus name, Amen.',
  },
  {
    id: 'lib-3',
    title: 'Prayer That Moves Mountains',
    author: 'Dr. Sarah Collins',
    publisher: 'Global Bible Institute',
    license: 'Approved Ministry Teaching License',
    type: 'video',
    category: 'Teachings',
    description:
      'A 3-part teaching series on the biblical theology and daily practice of intercessory prayer in the modern church.',
    duration: '18:30',
    thumbnail: 'prayer-video',
    approvalStatus: 'approved',
    uploadedAt: '2024-02-10',
    content:
      'Welcome to this teaching session on Prayer That Moves Mountains. In Mark 11:22-24, Jesus points His disciples first to the simplicity of faith: Have faith in God. Mountain-moving prayer is not rooted in the volume of our words, nor in our own willpower, but in alignment with the will and authority of our Heavenly Father. When we pray according to Scripture and forgive others freely, our hearts become clear channels of God’s kingdom power.',
  },
  {
    id: 'lib-4',
    title: 'Bible Study Guide: Epistle to the Romans',
    author: 'Grace Fellowship Team',
    publisher: 'Grace Fellowship Discipleship Press',
    license: 'Open Ministry Curriculum — Free for Small Groups',
    type: 'material',
    category: 'Study Guides',
    description:
      'A structured multi-session study guide through Paul’s letter to the Romans with commentary, discussion questions, and life application.',
    pages: 84,
    approvalStatus: 'approved',
    uploadedAt: '2024-04-05',
    content:
      'Paul’s letter to the Romans is the clearest presentation of the Gospel in Scripture. Week 1: The Power of the Gospel (Romans 1:16-17).',
    chapters: [
      {
        title: 'Session 1: Unashamed of the Gospel (Romans 1:1–17)',
        content:
          'Scripture Reading: Romans 1:16–17\n"For I am not ashamed of the gospel of Christ: for it is the power of God unto salvation to every one that believeth."\n\nKey Observation:\nPaul wrote to believers living in the capital of the Roman Empire, surrounded by worldly power and pride. Yet Paul declared that true transforming power belongs to the Gospel.\n\nDiscussion Questions:\n1. Why is it tempting to feel hesitant when sharing our faith today?\n2. What does it mean that "the righteous shall live by faith" in your daily decisions this week?',
      },
      {
        title: 'Session 2: Justified by Grace Through Faith (Romans 3:21–26)',
        content:
          'Scripture Reading: Romans 3:23–24\n"For all have sinned, and come short of the glory of God; Being justified freely by his grace through the redemption that is in Christ Jesus."\n\nKey Observation:\nNo human effort can erase guilt before a holy God, yet God Himself provided the redeemer. Justification is both a free gift ("freely by his grace") and a costly redemption paid at Calvary.\n\nPersonal Application:\nWrite down one area where you have been trying to earn God’s approval by performance rather than resting in Christ’s finished work.',
      },
      {
        title: 'Session 3: Life in the Spirit (Romans 8:1–17)',
        content:
          'Scripture Reading: Romans 8:1, 14–15\n"There is therefore now no condemnation to them which are in Christ Jesus... For ye have not received the spirit of bondage again to fear; but ye have received the Spirit of adoption, whereby we cry, Abba, Father."\n\nKey Observation:\nIn Christ, your legal standing is "no condemnation" and your relational standing is "adopted child of the King."',
      },
    ],
  },
  {
    id: 'lib-5',
    title: 'Worship & Devotional Podcast Ep. 24',
    author: 'Faith Media Team',
    publisher: 'Believers Audio Network',
    license: 'Approved Ministry Audio (CC BY-NC)',
    type: 'audio',
    category: 'Podcasts',
    description:
      'Weekly worship reflections on Psalm 91 and cultivating quiet trust in God amidst a noisy world.',
    duration: '10:15',
    approvalStatus: 'approved',
    uploadedAt: '2024-05-12',
    content:
      'Welcome to Episode 24 of the Worship and Devotional Podcast. Our meditation today comes from Psalm 91 verse 1: He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. Notice the difference between visiting a place in an emergency and dwelling there daily. God invites you to make His presence your permanent home today.',
  },
  {
    id: 'lib-6',
    title: 'The Practice of the Presence of God',
    author: 'Brother Lawrence',
    publisher: 'Public Domain (1692)',
    license: 'Public Domain — Unencumbered Christian Classic',
    type: 'book',
    category: 'Theology',
    description:
      'Collected conversations and letters on turning everyday duties and simple moments into continual fellowship with God.',
    pages: 96,
    approvalStatus: 'approved',
    uploadedAt: '2024-01-28',
    content:
      'We ought not to be weary of doing little things for the love of God, who regards not the greatness of the work, but the love with which it is performed.',
    chapters: [
      {
        title: 'First Conversation: Turning Ordinary Work into Worship',
        content:
          'The first time I saw Brother Lawrence was upon the 3rd of August, 1666. He told me that God had done him a singular favor in his conversion at the age of eighteen.\n\nHe said that we should establish ourselves in a sense of God’s Presence, by continually conversing with Him. That it was a shameful thing to quit His conversation to think of trifles and fooleries.\n\nEven in the bustle of the kitchen, while several persons were calling for different things at the same time, he possessed God in as great tranquility as if he were upon his knees at the blessed sacrament.',
      },
      {
        title: 'Second Conversation: Returning Promptly to Peace',
        content:
          'When we fail in our duty or wander in thought, Brother Lawrence advised not to grow discouraged, but to confess our fault simply to God and return immediately to His loving presence without lingering in self-pity.',
      },
    ],
  },
  {
    id: 'lib-7',
    title: 'Youth Conference Worship & Word Session',
    author: 'GBE Worship Team',
    publisher: 'Global Bible Experience Media',
    license: 'Ministry Broadcast Permission Granted',
    type: 'video',
    category: 'Worship',
    description:
      'Recorded message and worship exhortation from the Global Bible Experience Youth Conference on 1 Timothy 4:12.',
    duration: '15:00',
    thumbnail: 'youth-conference',
    approvalStatus: 'approved',
    uploadedAt: '2024-06-01',
    content:
      'Let no one despise your youth, but be an example to the believers in word, in conduct, in love, in spirit, in faith, in purity. First Timothy chapter 4 verse 12 reminds every young believer that God does not wait until tomorrow to use a surrendered heart.',
  },
  {
    id: 'lib-8',
    title: 'Marriage & Family Covenant Workbook',
    author: 'Pastor & Mrs. Adeyemi',
    publisher: 'Covenant Home Ministries',
    license: 'Approved Church Study Material',
    type: 'material',
    category: 'Family',
    description:
      'A practical couples workbook designed to strengthen Christian homes through biblical principles of grace, communication, and prayer.',
    pages: 56,
    approvalStatus: 'approved',
    uploadedAt: '2024-03-15',
    content:
      'Session 1: Covenant vs. Contract. A contract protects self-interest and plans for an exit; a covenant pledges steadfast love modeled after Christ’s love for the Church (Ephesians 5:25).',
    chapters: [
      {
        title: 'Week 1: Covenant vs. Contract (Ephesians 5:21–33)',
        content:
          'Key Principle: A contract says, "I will do my part as long as you do yours." A biblical covenant says, "By God’s grace, I commit to seeking your highest good as Christ loved the Church."\n\nCouples Exercise:\nShare three specific ways you can serve and encourage one another in prayer this week.',
      },
      {
        title: 'Week 2: Wise & Gentle Communication (James 1:19)',
        content:
          '"Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath." (James 1:19)\n\nPractice listening to understand before formulating a defense.',
      },
    ],
  },
]

export const initialPrayerAlerts: PrayerAlert[] = [
  { id: 'pr-1', title: 'Urgent: Hospital Surgery for Sister Grace', description: 'Please join us in praying for Sister Grace who is undergoing a complex heart surgery today. Pray for the medical team and complete healing.', urgency: 'critical', prayerCount: 247, userPrayed: false, status: 'active', createdAt: '2024-06-12T08:00:00Z', reminderEnabled: false, submittedBy: 'Prayer Ministry' },
  { id: 'pr-2', title: 'Daily Intercession: Nation Healing', description: 'Join the 6 AM daily prayer chain for our nation. Praying for peace, justice, and spiritual awakening across all communities.', urgency: 'daily', prayerCount: 1024, userPrayed: false, status: 'active', createdAt: '2024-06-12T06:00:00Z', reminderEnabled: false, submittedBy: 'Intercessory Team' },
  { id: 'pr-3', title: 'Missionary Update: East Africa Team', description: 'The East Africa missionary team reports persecution in their region. Pray for protection, wisdom, and continued access to the villages they serve.', urgency: 'critical', prayerCount: 532, userPrayed: false, status: 'active', createdAt: '2024-06-11T14:30:00Z', reminderEnabled: false, submittedBy: 'Missions Department' },
  { id: 'pr-4', title: 'Youth Retreat Preparation', description: 'Pray for the upcoming youth retreat next month. For registrations, volunteer recruitment, and spiritual readiness of all participants.', urgency: 'community', prayerCount: 89, userPrayed: false, status: 'active', createdAt: '2024-06-10T10:00:00Z', reminderEnabled: false, submittedBy: 'Youth Ministry' },
  { id: 'pr-5', title: 'Answered: Job Restoration for Brother David', description: 'Praise God! After 6 months of unemployment and prayer, Brother David received a job offer. Thank you all who prayed with us.', urgency: 'community', prayerCount: 156, userPrayed: false, status: 'answered', createdAt: '2024-06-08T16:00:00Z', reminderEnabled: false, submittedBy: 'Fellowship Group 3' },
]

export const initialNewsItems: NewsItem[] = [
  { id: 'news-1', title: 'Global Bible Experience 2024: Registration Now Open', excerpt: 'The largest gathering of believers this year is now accepting registrations. Early bird discounts available until July 15th.', content: "The Global Bible Experience 2024 promises to be the most impactful gathering yet, with over 50 international speakers, worship artists, and prayer warriors coming together for a week of transformation. This year's theme, Arise and Shine, calls believers to step into their God-given destiny...", category: 'global', publishDate: '2024-06-12', readTime: 4, featured: true, author: 'Events Team' },
  { id: 'news-2', title: 'New Community Center Opens in Riverside District', excerpt: "Our church's outreach ministry expands with a brand new community center offering free education, healthcare, and counseling services.", content: 'After two years of planning and construction, the new Riverside Community Center was officially dedicated in a ceremony attended by local leaders and over 500 congregation members. The center features a library, computer lab, health clinic, and multipurpose hall...', category: 'church', publishDate: '2024-06-11', readTime: 3, author: 'Communications' },
  { id: 'news-3', title: 'Youth Fellowship Records Highest Attendance in 5 Years', excerpt: 'The weekly youth gathering saw over 300 young people come together for worship, teaching, and small group discussions.', content: 'Youth Ministry Director Pastor Emmanuel shared his excitement about the growing numbers: These young people are hungry for authentic encounters with God. We are simply creating spaces where the Holy Spirit can move freely...', category: 'youth', publishDate: '2024-06-10', readTime: 2, author: 'Youth Team' },
  { id: 'news-4', title: 'Clean Water Project Reaches 10,000 Villagers', excerpt: 'Our global outreach initiative celebrates a major milestone as the 50th well is completed in rural communities across three nations.', content: 'The Living Water Initiative, launched three years ago, has transformed communities by providing access to clean drinking water. Each well serves approximately 200 people, reducing waterborne diseases and freeing women and children from hours of daily water collection...', category: 'outreach', publishDate: '2024-06-09', readTime: 5, author: 'Outreach Department' },
]

export const defaultUserStats: UserStats = {
  streak: 0,
  prayerHours: 0,
  itemsRead: 0,
  itemsListened: 0,
  answeredPrayers: 0,
  bookmarks: [],
  continueListening: [],
  continueReading: [],
}

function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function setToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* silent */ }
}

export function getLibraryProgressMap(): Record<string, number> {
  return getFromStorage<Record<string, number>>(STORAGE_KEYS.libraryProgress, {})
}

export function setLibraryItemProgress(id: string, progressPercent: number): LibraryItem[] {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)))
  const map = getLibraryProgressMap()
  map[id] = Math.max(map[id] ?? 0, clamped)
  setToStorage(STORAGE_KEYS.libraryProgress, map)
  return getLibraryItems()
}

export function getLibraryItems(): LibraryItem[] {
  const items = getFromStorage(STORAGE_KEYS.library, initialLibraryItems)
  const progressMap = getLibraryProgressMap()
  return items.map((item) => ({
    ...item,
    approvalStatus: item.approvalStatus || 'approved',
    progress: progressMap[item.id] ?? item.progress,
  }))
}

export function saveLibraryItems(items: LibraryItem[]): void {
  setToStorage(STORAGE_KEYS.library, items)
}

export function approveLibraryItem(id: string, status: 'approved' | 'rejected'): LibraryItem[] {
  const items = getLibraryItems()
    .map((item) => (item.id === id ? { ...item, approvalStatus: status } : item))
    .filter((item) => item.approvalStatus !== 'rejected')
  saveLibraryItems(items)
  return items
}

export type PrayerInteractionState = Record<
  string,
  { prayed: boolean; reminderEnabled: boolean; prayedAt?: string }
>

export function getPrayerInteractions(): PrayerInteractionState {
  return getFromStorage<PrayerInteractionState>(STORAGE_KEYS.prayerInteractions, {})
}

export function savePrayerInteractions(state: PrayerInteractionState): void {
  setToStorage(STORAGE_KEYS.prayerInteractions, state)
}

export function getPrayerAlerts(): PrayerAlert[] {
  const base = getFromStorage(STORAGE_KEYS.prayers, initialPrayerAlerts)
  const interactions = getPrayerInteractions()
  return base.map((a) => {
    const inter = interactions[a.id]
    if (!inter) return a
    return {
      ...a,
      userPrayed: inter.prayed,
      reminderEnabled: inter.reminderEnabled,
    }
  })
}

export function savePrayerAlerts(alerts: PrayerAlert[]): void {
  const previousInteractions = getPrayerInteractions()
  const interactions: PrayerInteractionState = { ...previousInteractions }
  alerts.forEach((a) => {
    if (a.userPrayed || a.reminderEnabled || interactions[a.id]) {
      const prev = interactions[a.id]
      const prayedNow = Boolean(a.userPrayed)
      interactions[a.id] = {
        prayed: prayedNow,
        reminderEnabled: Boolean(a.reminderEnabled),
        // Keep the original prayer timestamp instead of overwriting it on every save.
        prayedAt: prayedNow ? prev?.prayedAt || new Date().toISOString() : undefined,
      }
    }
  })
  savePrayerInteractions(interactions)
  setToStorage(STORAGE_KEYS.prayers, alerts)

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (!uid || !supabase) return
      Object.entries(interactions).forEach(([alertId, val]) => {
        if (val.prayed || val.reminderEnabled) {
          void trackServerWrite(
            'prayers',
            supabase
              .from('prayer_interactions')
              .upsert({
                user_id: uid,
                alert_id: alertId,
                reminder_enabled: val.reminderEnabled,
                prayed_at: val.prayedAt || new Date().toISOString(),
              })
          )
        } else if (previousInteractions[alertId]?.prayed) {
          // Un-praying must remove the server row, otherwise the next sync
          // resurrects the prayer (Phase 4 audit finding).
          void trackServerWrite(
            'prayers',
            supabase
              .from('prayer_interactions')
              .delete()
              .eq('user_id', uid)
              .eq('alert_id', alertId)
          )
        }
      })
    }, (err) => recordWriteError('prayers', err))
  }
}

export function getNewsItems(): NewsItem[] {
  return getFromStorage(STORAGE_KEYS.news, initialNewsItems)
}

export function saveNewsItems(items: NewsItem[]): void {
  setToStorage(STORAGE_KEYS.news, items)
}

export function getUserStats(): UserStats {
  return getFromStorage(STORAGE_KEYS.stats, defaultUserStats)
}

export function saveUserStats(stats: UserStats): void {
  setToStorage(STORAGE_KEYS.stats, stats)
}

export function addLibraryItem(item: LibraryItem): LibraryItem[] {
  const items = [item, ...getLibraryItems()]
  saveLibraryItems(items)
  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (!uid || !supabase) return
      supabase
        .from('library_items')
        .insert({
          title: item.title,
          author: item.author,
          type: item.type,
          category: item.category,
          description: item.description,
          featured: Boolean(item.featured),
          created_by: uid,
        })
        .then((res) => recordWriteOutcome('faith', res), (err) => recordWriteError('faith', err))
    })
  }
  return items
}

export function removeLibraryItem(id: string): LibraryItem[] {
  const items = getLibraryItems().filter((i) => i.id !== id)
  saveLibraryItems(items)
  if (supabase) {
    supabase.from('library_items').delete().eq('id', id).then((res) => recordWriteOutcome('faith', res), (err) => recordWriteError('faith', err))
  }
  return items
}

export function toggleBookmark(id: string, itemType: 'library' | 'news' = 'library'): string[] {
  const stats = getUserStats()
  const exists = stats.bookmarks.includes(id)
  const bookmarks = exists
    ? stats.bookmarks.filter((b) => b !== id)
    : [...stats.bookmarks, id]
  stats.bookmarks = bookmarks
  saveUserStats(stats)

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (!uid || !supabase) return
      if (!exists) {
        supabase
          .from('bookmarks')
          .upsert({ user_id: uid, item_type: itemType, item_id: id })
          .then((res) => recordWriteOutcome('faith', res), (err) => recordWriteError('faith', err))
      } else {
        supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', uid)
          .eq('item_type', itemType)
          .eq('item_id', id)
          .then((res) => recordWriteOutcome('faith', res), (err) => recordWriteError('faith', err))
      }
    })
  }

  return bookmarks
}

/** Sync shared content & user bookmarks/interactions from Supabase when signed in. */
export async function syncFaithDataFromServer(): Promise<{
  libraryItems: LibraryItem[]
  prayerAlerts: PrayerAlert[]
  newsItems: NewsItem[]
  bookmarks: string[]
  /** Set when any server read failed — callers must NOT report success. */
  error?: string
}> {
  if (!supabase) {
    return {
      libraryItems: getLibraryItems(),
      prayerAlerts: getPrayerAlerts(),
      newsItems: getNewsItems(),
      bookmarks: getUserStats().bookmarks,
    }
  }

  const pullErrors: string[] = []

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id

    const [libRes, alertRes, newsRes] = await Promise.all([
      supabase.from('library_items').select('*').order('created_at', { ascending: false }),
      supabase.from('prayer_alerts').select('*').order('created_at', { ascending: false }),
      supabase.from('news_items').select('*').order('created_at', { ascending: false }),
    ])

    if (libRes.error) pullErrors.push(`library: ${libRes.error.message}`)
    if (alertRes.error) pullErrors.push(`prayer alerts: ${alertRes.error.message}`)
    if (newsRes.error) pullErrors.push(`news: ${newsRes.error.message}`)

  if (!libRes.error && libRes.data && libRes.data.length > 0) {
      const remoteLib: LibraryItem[] = libRes.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        author: String(r.author ?? ''),
        type: (r.type as MediaType) || 'book',
        category: String(r.category ?? 'General'),
        description: String(r.description ?? ''),
        featured: Boolean(r.featured),
        approvalStatus: 'approved',
        uploadedAt: String(r.created_at ?? '').slice(0, 10) || '2024-06-01',
      }))
      const localLib = getLibraryItems()
      const byId = new Map<string, LibraryItem>()
      localLib.forEach((i) => byId.set(i.id, i))
      remoteLib.forEach((i) => byId.set(i.id, { ...byId.get(i.id), ...i }))
      saveLibraryItems(Array.from(byId.values()))
    }

    if (!alertRes.error && alertRes.data && alertRes.data.length > 0) {
      const remoteAlerts: PrayerAlert[] = alertRes.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        description: String(r.description ?? ''),
        urgency: (r.urgency as UrgencyLevel) || 'community',
        prayerCount: 0,
        userPrayed: false,
        status: (r.status as AlertStatus) || 'active',
        createdAt: String(r.created_at ?? new Date().toISOString()),
        reminderEnabled: false,
        submittedBy: String(r.submitted_by ?? 'Admin'),
      }))
      const localAlerts = getPrayerAlerts()
      const byId = new Map<string, PrayerAlert>()
      localAlerts.forEach((a) => byId.set(a.id, a))
      remoteAlerts.forEach((a) => byId.set(a.id, { ...a, ...byId.get(a.id) }))
      savePrayerAlerts(Array.from(byId.values()))
    }

    if (!newsRes.error && newsRes.data && newsRes.data.length > 0) {
      const remoteNews: NewsItem[] = newsRes.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        excerpt: String(r.excerpt ?? ''),
        content: String(r.content ?? ''),
        category: (r.category as NewsCategory) || 'church',
        publishDate: String(r.publish_date ?? '').slice(0, 10) || '2024-06-01',
        readTime: Number(r.read_time ?? 2),
        author: String(r.author ?? 'Admin'),
      }))
      const localNews = getNewsItems()
      const byId = new Map<string, NewsItem>()
      localNews.forEach((n) => byId.set(n.id, n))
      remoteNews.forEach((n) => byId.set(n.id, { ...byId.get(n.id), ...n }))
      saveNewsItems(Array.from(byId.values()))
    }

    if (uid) {
      const [bmRes, piRes] = await Promise.all([
        supabase.from('bookmarks').select('*').eq('user_id', uid),
        supabase.from('prayer_interactions').select('*').eq('user_id', uid),
      ])

      if (bmRes.error) pullErrors.push(`bookmarks: ${bmRes.error.message}`)
      if (piRes.error) pullErrors.push(`prayer interactions: ${piRes.error.message}`)

      if (!bmRes.error && bmRes.data) {
        const stats = getUserStats()
        const bmSet = new Set(stats.bookmarks)
        bmRes.data.forEach((r: Record<string, unknown>) => {
          if (r.item_type === 'library' || r.item_type === 'news') {
            bmSet.add(String(r.item_id))
          }
        })
        stats.bookmarks = Array.from(bmSet)
        saveUserStats(stats)
      }

      if (!piRes.error && piRes.data) {
        const interactions = getPrayerInteractions()
        piRes.data.forEach((r: Record<string, unknown>) => {
          const key = String(r.alert_id)
          const localVal = interactions[key]
          if (localVal && !localVal.prayed && !localVal.reminderEnabled) {
            // This device explicitly un-prayed/removed the interaction. Do not
            // resurrect it from a stale cloud row; re-push the deletion instead.
            void trackServerWrite(
              'prayers',
              supabase!
                .from('prayer_interactions')
                .delete()
                .eq('user_id', uid)
                .eq('alert_id', key)
            )
            return
          }
          interactions[key] = {
            prayed: true,
            reminderEnabled: Boolean(r.reminder_enabled),
            ...(localVal?.prayedAt ? { prayedAt: localVal.prayedAt } : {}),
          }
        })
        savePrayerInteractions(interactions)
      }

      const dpRes = await supabase.from('devotional_progress').select('*').eq('user_id', uid)
      if (dpRes.error) {
        pullErrors.push(`devotional progress: ${dpRes.error.message}`)
      } else if (dpRes.data) {
        const map = getCompletedDevotionalMap()
        dpRes.data.forEach((r: Record<string, unknown>) => {
          const key = String(r.devotional_id)
          if (!key) return
          const remoteDate = String(r.completed_at ?? r.entry_date ?? '').slice(0, 10)
          const localDate = String(map[key] ?? '').slice(0, 10)
          if (!localDate || remoteDate > localDate) {
            // Latest completion wins; never remove a local completion the
            // server has not seen yet (it may have failed to push).
            map[key] = remoteDate || new Date().toISOString().slice(0, 10)
          }
        })
        saveCompletedDevotionalMap(map)
      }
    }
  } catch (err) {
    pullErrors.push(err instanceof Error ? err.message : 'network unavailable')
  }

  const error = pullErrors.length > 0 ? pullErrors.join('; ') : undefined
  if (error) {
    recordSyncFailure('faith', error)
  } else {
    clearSyncFailure('faith')
  }

  return {
    libraryItems: getLibraryItems(),
    prayerAlerts: getPrayerAlerts(),
    newsItems: getNewsItems(),
    bookmarks: getUserStats().bookmarks,
    ...(error ? { error } : {}),
  }
}
