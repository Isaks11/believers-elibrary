export type MediaType = 'book' | 'audio' | 'video' | 'material'
export type UrgencyLevel = 'critical' | 'daily' | 'community'
export type NewsCategory = 'global' | 'church' | 'youth' | 'outreach'
export type AlertStatus = 'active' | 'answered' | 'archived'

export interface LibraryItem {
  id: string
  title: string
  author: string
  type: MediaType
  category: string
  description: string
  duration?: string
  pages?: number
  thumbnail?: string
  content?: string
  featured?: boolean
  bookmarked?: boolean
  progress?: number
  uploadedAt: string
}

export interface PrayerAlert {
  id: string
  title: string
  description: string
  urgency: UrgencyLevel
  prayerCount: number
  userPrayed: boolean
  status: AlertStatus
  createdAt: string
  reminderEnabled: boolean
  submittedBy: string
}

export interface NewsItem {
  id: string
  title: string
  excerpt: string
  content: string
  category: NewsCategory
  publishDate: string
  readTime: number
  thumbnail?: string
  featured?: boolean
  bookmarked?: boolean
  author: string
}

export interface UserStats {
  streak: number
  prayerHours: number
  itemsRead: number
  itemsListened: number
  answeredPrayers: number
  bookmarks: string[]
  continueListening: LibraryItem[]
  continueReading: LibraryItem[]
}

export interface AdminMetrics {
  totalLibraryItems: number
  activePrayerAlerts: number
  registeredUsers: number
  newsReadRate: number
}
