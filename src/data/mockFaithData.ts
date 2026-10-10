import { LibraryItem, PrayerAlert, NewsItem, UserStats } from '@/types/library-news'

const STORAGE_KEYS = {
  library: "faith_library_items",
  prayers: "faith_prayer_alerts",
  news: "faith_news_items",
  stats: "faith_user_stats",
  bookmarks: "faith_bookmarks",
}

export const initialLibraryItems: LibraryItem[] = [
  { id: "lib-1", title: "The Purpose Driven Life", author: "Rick Warren", type: "book", category: "Spiritual Growth", description: "A 40-day journey through understanding God's purpose for your life. This devotional classic helps readers discover their identity in Christ.", pages: 368, featured: true, progress: 65, uploadedAt: "2024-01-15", content: "What am I doing here? It's a question people have asked for centuries..." },
  { id: "lib-2", title: "Walking in Faith Sunday Sermon", author: "Pastor James Mitchell", type: "audio", category: "Sermons", description: "A powerful message about stepping out of your comfort zone and trusting God's plan even when the path is unclear.", duration: "42:15", featured: true, uploadedAt: "2024-03-20" },
  { id: "lib-3", title: "Prayer That Moves Mountains", author: "Dr. Sarah Collins", type: "video", category: "Teachings", description: "A 3-part video teaching series on the theology and practice of intercessory prayer in the modern church.", duration: "1:28:30", thumbnail: "prayer-video", uploadedAt: "2024-02-10" },
  { id: "lib-4", title: "Bible Study Guide: Romans", author: "Grace Fellowship Team", type: "material", category: "Study Guides", description: "A comprehensive 12-week study guide through the book of Romans with discussion questions and application exercises.", pages: 84, uploadedAt: "2024-04-05" },
  { id: "lib-5", title: "Worship & Devotional Podcast Ep. 24", author: "Faith Media Team", type: "audio", category: "Podcasts", description: "Weekly worship reflections with guest artists sharing their testimonies and leading in prayer.", duration: "35:42", uploadedAt: "2024-05-12" },
  { id: "lib-6", title: "The Prodigal God", author: "Timothy Keller", type: "book", category: "Theology", description: "Rediscovering the heart of the Christian faith through the parable of the lost sons. A profound exploration of grace.", pages: 144, progress: 30, uploadedAt: "2024-01-28" },
  { id: "lib-7", title: "Youth Conference Worship Night", author: "GBE Worship Team", type: "video", category: "Worship", description: "Full recording of the electrifying worship night at the 2024 Global Bible Experience Youth Conference.", duration: "2:15:00", thumbnail: "youth-conference", uploadedAt: "2024-06-01" },
  { id: "lib-8", title: "Marriage Enrichment Workbook", author: "Pastor & Mrs. Adeyemi", type: "material", category: "Family", description: "A 6-week couples workbook designed to strengthen marriages through biblical principles of love, communication, and commitment.", pages: 56, uploadedAt: "2024-03-15" },
]

export const initialPrayerAlerts: PrayerAlert[] = [
  { id: "pr-1", title: "Urgent: Hospital Surgery for Sister Grace", description: "Please join us in praying for Sister Grace who is undergoing a complex heart surgery today. Pray for the medical team and complete healing.", urgency: "critical", prayerCount: 247, userPrayed: false, status: "active", createdAt: "2024-06-12T08:00:00Z", reminderEnabled: true, submittedBy: "Prayer Ministry" },
  { id: "pr-2", title: "Daily Intercession: Nation Healing", description: "Join the 6 AM daily prayer chain for our nation. Praying for peace, justice, and spiritual awakening across all communities.", urgency: "daily", prayerCount: 1024, userPrayed: true, status: "active", createdAt: "2024-06-12T06:00:00Z", reminderEnabled: true, submittedBy: "Intercessory Team" },
  { id: "pr-3", title: "Missionary Update: East Africa Team", description: "The East Africa missionary team reports persecution in their region. Pray for protection, wisdom, and continued access to the villages they serve.", urgency: "critical", prayerCount: 532, userPrayed: false, status: "active", createdAt: "2024-06-11T14:30:00Z", reminderEnabled: false, submittedBy: "Missions Department" },
  { id: "pr-4", title: "Youth Retreat Preparation", description: "Pray for the upcoming youth retreat next month. For registrations, volunteer recruitment, and spiritual readiness of all participants.", urgency: "community", prayerCount: 89, userPrayed: false, status: "active", createdAt: "2024-06-10T10:00:00Z", reminderEnabled: false, submittedBy: "Youth Ministry" },
  { id: "pr-5", title: "Answered: Job Restoration for Brother David", description: "Praise God! After 6 months of unemployment and prayer, Brother David received a job offer. Thank you all who prayed with us.", urgency: "community", prayerCount: 156, userPrayed: true, status: "answered", createdAt: "2024-06-08T16:00:00Z", reminderEnabled: false, submittedBy: "Fellowship Group 3" },
]

export const initialNewsItems: NewsItem[] = [
  { id: "news-1", title: "Global Bible Experience 2024: Registration Now Open", excerpt: "The largest gathering of believers this year is now accepting registrations. Early bird discounts available until July 15th.", content: "The Global Bible Experience 2024 promises to be the most impactful gathering yet, with over 50 international speakers, worship artists, and prayer warriors coming together for a week of transformation. This year's theme, Arise and Shine, calls believers to step into their God-given destiny...", category: "global", publishDate: "2024-06-12", readTime: 4, featured: true, author: "Events Team" },
  { id: "news-2", title: "New Community Center Opens in Riverside District", excerpt: "Our church's outreach ministry expands with a brand new community center offering free education, healthcare, and counseling services.", content: "After two years of planning and construction, the new Riverside Community Center was officially dedicated in a ceremony attended by local leaders and over 500 congregation members. The center features a library, computer lab, health clinic, and multipurpose hall...", category: "church", publishDate: "2024-06-11", readTime: 3, author: "Communications" },
  { id: "news-3", title: "Youth Fellowship Records Highest Attendance in 5 Years", excerpt: "The weekly youth gathering saw over 300 young people come together for worship, teaching, and small group discussions.", content: "Youth Ministry Director Pastor Emmanuel shared his excitement about the growing numbers: These young people are hungry for authentic encounters with God. We are simply creating spaces where the Holy Spirit can move freely...", category: "youth", publishDate: "2024-06-10", readTime: 2, author: "Youth Team" },
  { id: "news-4", title: "Clean Water Project Reaches 10,000 Villagers", excerpt: "Our global outreach initiative celebrates a major milestone as the 50th well is completed in rural communities across three nations.", content: "The Living Water Initiative, launched three years ago, has transformed communities by providing access to clean drinking water. Each well serves approximately 200 people, reducing waterborne diseases and freeing women and children from hours of daily water collection...", category: "outreach", publishDate: "2024-06-09", readTime: 5, author: "Outreach Department" },
]

export const defaultUserStats: UserStats = {
  streak: 12,
  prayerHours: 87,
  itemsRead: 24,
  itemsListened: 45,
  answeredPrayers: 18,
  bookmarks: ["lib-1", "lib-6", "news-1"],
  continueListening: [initialLibraryItems[1], initialLibraryItems[4]],
  continueReading: [initialLibraryItems[0], initialLibraryItems[5]],
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

export function getLibraryItems(): LibraryItem[] {
  return getFromStorage(STORAGE_KEYS.library, initialLibraryItems)
}

export function saveLibraryItems(items: LibraryItem[]): void {
  setToStorage(STORAGE_KEYS.library, items)
}

export function getPrayerAlerts(): PrayerAlert[] {
  return getFromStorage(STORAGE_KEYS.prayers, initialPrayerAlerts)
}

export function savePrayerAlerts(alerts: PrayerAlert[]): void {
  setToStorage(STORAGE_KEYS.prayers, alerts)
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
  return items
}

export function removeLibraryItem(id: string): LibraryItem[] {
  const items = getLibraryItems().filter(i => i.id !== id)
  saveLibraryItems(items)
  return items
}

export function toggleBookmark(id: string): string[] {
  const stats = getUserStats()
  const bookmarks = stats.bookmarks.includes(id)
    ? stats.bookmarks.filter(b => b !== id)
    : [...stats.bookmarks, id]
  stats.bookmarks = bookmarks
  saveUserStats(stats)
  return bookmarks
}
