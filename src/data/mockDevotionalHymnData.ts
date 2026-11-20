import { DevotionalEntry, Hymn, BibleVersion, MONTHS, DAYS_OF_WEEK } from '@/types/devotional-hymn'
import { supabase } from '@/lib/supabase'
import { recordWriteOutcome, recordWriteError } from '@/lib/syncHealth'

const DEVOTIONALS_KEY = 'gebeya-devotionals-v2'
const DEVOTIONAL_COMPLETED_KEY = 'devotional_completed_map'
const DEVOTIONAL_BOOKMARKS_KEY = 'devotional_bookmarks_list'
const HYMN_FAVORITES_KEY = 'hymn_favorites_list'
const HYMNS_KEY = 'gebeya-hymns'

const VERSION_TEXTS: Record<string, string> = {
  KJV: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.",
  WEB: "For I know the thoughts that I think toward you, says Yahweh, thoughts of peace, and not of evil, to give you hope and a future.",
  BBE: "For I am conscious of my thoughts about you, says the Lord, thoughts of peace and not of evil, to give you hope at the end.",
  ASV: "For I know the thoughts that I think toward you, saith Jehovah, thoughts of peace, and not of evil, to give you hope in your latter end.",
  ESV: "For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.",
}

const VERSES: { ref: string, texts: Partial<Record<BibleVersion, string>> }[] = [
  { ref: 'Jeremiah 29:11', texts: VERSION_TEXTS },
  { ref: 'Psalm 23:1-3', texts: {
    KJV: "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.",
    WEB: "Yahweh is my shepherd; I shall lack nothing. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.",
    BBE: "The Lord is my keeper; I will have no need of anything. He makes me take my rest in green fields: he is my guide by the quiet waters. He gives new life to my soul.",
    ASV: "Jehovah is my shepherd; I shall not want. He maketh me to lie down in green pastures; He leadeth me beside still waters. He restoreth my soul.",
    ESV: "The LORD is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.",
  } },
  { ref: 'Isaiah 41:10', texts: {
    KJV: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.",
    WEB: "Do not be afraid, for I am with you. Do not be dismayed, for I am your God. I will strengthen you. Yes, I will help you.",
    BBE: "Have no fear, for I am with you; do not be looking about in trouble, for I am your God; I will give you strength, yes, I will be your helper.",
    ASV: "Fear thou not; for I am with thee: be not dismayed; for I am thy God; I will strengthen thee; yea, I will help thee.",
    ESV: "Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you.",
  } },
  { ref: 'Romans 8:28', texts: {
    KJV: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    WEB: "We know that all things work together for good for those who love God, for those who are called according to his purpose.",
    BBE: "And we are conscious that all things work together for good to those who have love for God, and have been marked out by his purpose.",
    ASV: "And we know that to them that love God all things work together for good, even to them that are called according to his purpose.",
    ESV: "And we know that for those who love God all things work together for good, for those who are called according to his purpose.",
  } },
  { ref: 'Philippians 4:13', texts: {
    KJV: "I can do all things through Christ which strengtheneth me.",
    WEB: "I can do all things through Christ, who strengthens me.",
    BBE: "I am able to do all things through him who gives me strength.",
    ASV: "I can do all things in him that strengtheneth me.",
    ESV: "I can do all things through him who strengthens me.",
  } },
  { ref: 'Proverbs 3:5-6', texts: {
    KJV: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    WEB: "Trust in Yahweh with all your heart, and don't lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.",
    BBE: "Put all your hope in God, not looking to your reason for support. In all your ways give ear to him, and he will make your roads straight.",
    ASV: "Trust in Jehovah with all thy heart, And lean not upon thine own understanding: In all thy ways acknowledge him, And he will direct thy paths.",
    ESV: "Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.",
  } },
  { ref: 'Matthew 6:33', texts: {
    KJV: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    WEB: "But seek first God's Kingdom, and his righteousness; and all these things will be given to you as well.",
    BBE: "But let your first care be for his kingdom and his righteousness; and all these other things will be given to you in addition.",
    ASV: "But seek ye first his kingdom, and his righteousness; and all these things shall be added unto you.",
    ESV: "But seek first the kingdom of God and his righteousness, and all these things will be added to you.",
  } },
]

interface BodyTemplate {
  title: string
  theme: string
  author: string
  mainBody: string
  keyThought: string
  prayer: string
  prayerPoints: string[]
  tags: string[]
}

const BODIES: BodyTemplate[] = [
  {
    title: 'Walking in Divine Purpose', theme: 'Purpose & Calling', author: 'Rev. Daniel Mensah',
    mainBody: `In our walk with God, there are moments where the path ahead seems obscured by clouds of uncertainty. We often find ourselves questioning if we are truly following His lead or if we have somehow wandered off the track.

But the scriptures remind us of a fundamental truth: God's plans for us are intentional. They are not accidental, nor are they subject to the whims of chance. He is the Great Architect of our lives, and every season, even the quiet ones, serves a purpose in His grand design.

When you feel stalled, remember that preparation often looks like waiting. Joseph waited in prison, David waited in the wilderness, and Moses waited in Midian. In each silence, God was shaping character, building faith, and aligning hearts for the assignment ahead.

Today, do not despise the season you are in. Every step of obedience is a step toward His purpose. Your foundation is being laid even now, and what God is building in the secret place will be seen in the open.`,
    keyThought: "God's plans for your life are intentional. Trust the process, for preparation looks like waiting.",
    prayer: "Dear Lord, thank You for Your unwavering promises. I surrender my worries and my future into Your capable hands. Help me to trust Your timing and Your purpose above my own understanding. Amen.",
    prayerPoints: ['Peace in decision making', 'Strength for the journey', 'Clarity of vision'],
    tags: ['purpose', 'faith', 'trust'],
  },
  {
    title: 'The Shepherd Who Leads', theme: 'Guidance & Care', author: 'Pastor Grace Osei',
    mainBody: `The image of the Shepherd is one of the most tender pictures of God in all of Scripture. A shepherd does not drive the sheep from behind with harsh commands; he leads from the front, walking the path first so that the flock follows in safe footsteps.

Our Good Shepherd knows each of us by name. He knows when we are tired, when we are hungry for truth, and when we have strayed into dangerous territory. His rod and staff are not weapons against us but tools for our protection and correction.

Green pastures and still waters speak of provision and peace, yet these blessings are found by simply staying near the Shepherd. The sheep that wander are not the ones who love the Shepherd less, but the ones who stop listening to His voice.

Choose today to follow closely. When you are unsure of the next step, stay near Him, and He will guide you beside the still waters your soul longs for.`,
    keyThought: "Stay close to the Shepherd; provision and peace are found in His presence, not in wandering.",
    prayer: "Good Shepherd, I thank You for knowing me by name and for leading me to places of rest. When I am prone to wander, draw me back with Your gentle voice. Amen.",
    prayerPoints: ['A heart that listens', 'Protection from danger', 'Rest for the weary soul'],
    tags: ['guidance', 'psalm-23', 'comfort'],
  },
  {
    title: 'Fear Not, For I Am With You', theme: 'Courage & Strength', author: 'Evangelist Samuel Boateng',
    mainBody: `Fear has a way of magnifying itself in the dark. What seems small in daylight can feel overwhelming when we face it alone. Yet God's most repeated command in Scripture is this: do not be afraid.

The reason is not that the storms are small, but that His presence is great. When God says fear not, He does not dismiss the size of your mountain; He reminds you of the size of His faithfulness. I am with you. I will strengthen you. I will uphold you with My righteous right hand.

Christian courage is not the absence of fear, it is the resolve to move forward while trusting the One who walks beside you. The same hand that calmed the sea is holding you today.

Stand firm. God has not given you a spirit of fear, but of power, love, and a sound mind.`,
    keyThought: "Feel the fear, name it, and release it to God, who is greater than any storm you face.",
    prayer: "Father, when fear whispers, let Your voice thunder louder. I receive Your strength and Your peace this very moment. Hold me by Your right hand and do not let go. Amen.",
    prayerPoints: ['Courage for new beginnings', 'Freedom from anxiety', 'Confidence in God’s presence'],
    tags: ['courage', 'fear-not', 'strength'],
  },
  {
    title: 'All Things Working for Good', theme: 'Hope & Redemption', author: 'Deaconess Abigail Owusu',
    mainBody: `Life has a way of writing chapters we never planned. Broken relationships, closed doors, and seasons of grief can leave us questioning the goodness of God. It is in these moments that Romans 8:28 becomes an anchor for the soul.

God is not the author of evil, but He is the Master Redeemer who weaves even our darkest threads into a tapestry of beauty. Joseph declared to his brothers, you meant evil against me, but God meant it for good. The cross itself stands as the ultimate proof that God brings life out of death.

Your setback is not your ending. The wardrobe of heaven is drafting your comeback in the quiet. What the enemy intended for your harm, God will use for your testimony.

Hold on, beloved. Your story is not finished, and the Author is still writing.`,
    keyThought: "God redeems every broken piece. What was meant for harm will be turned for good in His hands.",
    prayer: "Lord, I bring You the fragments of my story. Take what the enemy meant for evil and fashion it into glory. Help me trust that You are working all things for my good. Amen.",
    prayerPoints: ['Healing of past wounds', 'A redeemed story', 'Eyes to see God working'],
    tags: ['hope', 'redemption', 'romans-8'],
  },
  {
    title: 'Strength for Every Moment', theme: 'Empowerment', author: 'Rev. Daniel Mensah',
    mainBody: `There are days when the assignment outweighs the strength we feel within us. Deadlines press, responsibilities pile, and our souls grow weary. In those moments, Philippians 4:13 is not a motivational slogan, it is a lifeline.

I can do all things through Christ who strengthens me. The emphasis is not on all things but on through Christ. Left to ourselves, we falter. Connected to Him, we are empowered beyond our natural capacity.

The secret is surrender, not striving. It is admitting I cannot, but He can, and allowing His strength to flow through our weakness. Paul boasted in his weaknesses because God's power was made perfect in them.

Today, whatever the mountain, let Christ be your strength. You were never meant to carry it alone.`,
    keyThought: "Your weakness is the channel for His power. Do not strive, surrender and receive strength from Christ.",
    prayer: "Jesus, You are my strength and my song. When I am weak, be my power; when I am tired, be my rest. I lean fully on You today. Amen.",
    prayerPoints: ['Renewed strength', 'Wisdom for challenges', 'Perseverance in trials'],
    tags: ['strength', 'philippians', 'perseverance'],
  },
  {
    title: 'Trusting the Heart of God', theme: 'Surrender & Trust', author: 'Pastor Grace Osei',
    mainBody: `Proverbs 3:5-6 calls us to a radical kind of trust: leaning not on our own understanding. This is difficult because understanding feels safe. We want to see the full map before we take the first step.

But God does not call us to understand everything; He calls us to trust Someone. A child does not understand the surgery, yet trusts the physician's hands. A disciple does not understand the storm, yet trusts the Master's voice.

The promise is specific: acknowledge Him in all your ways, and He will direct your paths. Direction is not withheld until we have perfect clarity; it is given as we take faithful steps of surrender.

Release the need to have it all figured out. Choose trust today, and watch God make your paths straight.`,
    keyThought: "Trust is not understanding everything, it is acknowledging God in every step and letting Him direct.",
    prayer: "Father, I confess that I often want to control the outcome. Today I lay down my understanding and choose to trust You completely. Direct my steps, Lord. Amen.",
    prayerPoints: ['Daily surrender', 'Guidance for decisions', 'Freedom from control'],
    tags: ['trust', 'surrender', 'proverbs-3'],
  },
  {
    title: 'Seeking First the Kingdom', theme: 'Priorities & Devotion', author: 'Evangelist Samuel Boateng',
    mainBody: `In the Sermon on the Mount, Jesus addresses our deepest anxieties about provision: what we will eat, what we will drink, what we will wear. He knows the human heart worries about tomorrow.

His answer reorders our priorities. Seek first the kingdom of God and His righteousness, and all these things shall be added to you. The word seek is not casual; it is the language of a treasure hunter, a diligent devotion.

When God is first, everything else finds its proper place. Financial worries shrink when eternal treasures grow. Anxiety diminishes as faith expands. The formula is simple, but our hearts resist it daily.

Begin today by giving God the first hour, the first thought, the first portion. Watch how He adds everything else.`,
    keyThought: "Put God first in your hunger, and He will add everything else. Seek His kingdom above all.",
    prayer: "Lord, forgive me for the worries that crowd out my worship. I choose to seek Your kingdom first today. Order my priorities and add what I need. Amen.",
    prayerPoints: ['Purity of priorities', 'Contentment in Christ', 'Faith over anxiety'],
    tags: ['priorities', 'kingdom', 'provision'],
  },
  {
    title: 'Be Still and Know', theme: 'Rest & Peace', author: 'Deaconess Abigail Owusu',
    mainBody: `Psalm 46:10 invites us to a posture our culture has all but forgotten: stillness. Be still, and know that I am God. In a world of notifications, noise, and endless activity, this command feels almost impossible.

Yet stillness is where we know God most intimately. Elijah did not hear the Lord in the wind, the earthquake, or the fire, but in a still small voice. It is in the quiet that our hearts are calibrated to His frequency.

To be still is not to be passive; it is to be present. It is stopping our striving long enough to remember who is actually in control. The battle belongs to the Lord.

Carve out a quiet space today. Still your soul, quiet your mind, and know that He is God.`,
    keyThought: "Stillness is not emptiness; it is sacred space where we remember God is in control.",
    prayer: "Prince of Peace, quiet the noise within me. Help me to be still and simply know that You are God. Teach my restless heart to rest in You. Amen.",
    prayerPoints: ['Inner stillness', 'Freedom from hurry', 'Intimacy with God'],
    tags: ['rest', 'peace', 'stillness'],
  },
]

let cachedSeedDevotionals: DevotionalEntry[] | null = null

function buildSeedDevotionals(): DevotionalEntry[] {
  // Only devotionals configured by the admin are displayed
  return []
}

export function getCompletedDevotionalMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEVOTIONAL_COMPLETED_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCompletedDevotionalMap(map: Record<string, string>) {
  try {
    localStorage.setItem(DEVOTIONAL_COMPLETED_KEY, JSON.stringify(map))
  } catch { /* storage full */ }
}

export function getBookmarkedDevotionalIds(): string[] {
  try {
    const raw = localStorage.getItem(DEVOTIONAL_BOOKMARKS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveBookmarkedDevotionalIds(ids: string[]) {
  try {
    localStorage.setItem(DEVOTIONAL_BOOKMARKS_KEY, JSON.stringify(ids))
  } catch { /* storage full */ }
}

export function getFavoriteHymnIds(): string[] {
  try {
    const raw = localStorage.getItem(HYMN_FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFavoriteHymnIds(ids: string[]) {
  try {
    localStorage.setItem(HYMN_FAVORITES_KEY, JSON.stringify(ids))
  } catch { /* storage full */ }
}

function loadCmsDevotionals(): DevotionalEntry[] {
  try {
    const raw = localStorage.getItem('cms_devotionals_v1')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const completedMap = getCompletedDevotionalMap()
    const bookmarkedSet = new Set(getBookmarkedDevotionalIds())

    // Only published devotionals configured by admin
    const published = parsed.filter((r) => r && r.status === 'published')
    return published.map((record) => {
      const id = record.id.startsWith('cms:') ? record.id : `cms:${record.id}`
      const dateStr = record.devotional_date || record.published_at || record.created_at || ''
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
      const now = new Date()
      const year = match ? Number(match[1]) : now.getFullYear()
      const rawMonthIndex = match ? Number(match[2]) - 1 : now.getMonth()
      const monthIndex = rawMonthIndex >= 0 && rawMonthIndex < 12 ? rawMonthIndex : now.getMonth()
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
      const rawDay = match ? Number(match[3]) : now.getDate()
      const day = Math.min(Math.max(rawDay, 1), daysInMonth)
      const dObj = new Date(year, monthIndex, day)
      const month = MONTHS[monthIndex] || MONTHS[now.getMonth()]
      const dayOfWeek = DAYS_OF_WEEK[(dObj.getDay() + 6) % 7]
      const body = record.body || ''
      const paragraphs = body.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean)
      const wordCount = body.split(/\s+/).filter(Boolean).length

      const manualPrayer = typeof record.prayer === 'string' ? record.prayer.trim() : ''
      return {
        id,
        year,
        month,
        day,
        dayOfWeek,
        title: record.title || 'Untitled Devotional',
        theme: (record.category && record.category.trim()) || 'Devotion',
        scriptureRef: record.verse_ref || '',
        bibleVersions: record.verse_text ? { KJV: record.verse_text } : {},
        mainBody: body,
        keyThought: '',
        prayer: manualPrayer,
        prayerPoints: [],
        author: (record.author && record.author.trim()) || 'Church Library',
        readTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
        tags: Array.isArray(record.tags) ? record.tags : [],
        isCompleted: Boolean(completedMap[id]),
        isBookmarked: bookmarkedSet.has(id),
      }
    })
  } catch {
    return []
  }
}

function loadCustomDevotionals(): DevotionalEntry[] {
  try {
    const raw = localStorage.getItem(DEVOTIONALS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full */ }
}

export const getDevotionals = (): DevotionalEntry[] => {
  const completedMap = getCompletedDevotionalMap()
  const bookmarkedSet = new Set(getBookmarkedDevotionalIds())
  const custom = loadCustomDevotionals()
  const cms = loadCmsDevotionals()
  const base = buildSeedDevotionals()
  const merged = [...cms, ...custom, ...base]
  return merged.map((d) => ({
    ...d,
    isCompleted: Boolean(completedMap[d.id]),
    isBookmarked: bookmarkedSet.has(d.id),
  }))
}

export const saveDevotionals = (items: DevotionalEntry[]) => {
  const completedMap: Record<string, string> = {}
  const existingMap = getCompletedDevotionalMap()
  const bookmarked: string[] = []
  items.forEach((d) => {
    if (d.isCompleted) {
      const mIdx = MONTHS.indexOf(d.month)
      const fallbackDate = `${d.year}-${String(mIdx + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
      completedMap[d.id] = existingMap[d.id] || fallbackDate
    }
    if (d.isBookmarked) bookmarked.push(d.id)
  })
  saveCompletedDevotionalMap(completedMap)
  saveBookmarkedDevotionalIds(bookmarked)
}

export const addDevotional = (item: DevotionalEntry) => {
  const custom = [item, ...loadCustomDevotionals()]
  persist(DEVOTIONALS_KEY, custom)
  return getDevotionals()
}

export const updateDevotional = (id: string, patch: Partial<DevotionalEntry>) => {
  const all = getDevotionals()
  const target = all.find((d) => d.id === id)

  if (typeof patch.isCompleted === 'boolean' && target) {
    const completedMap = getCompletedDevotionalMap()
    const mIdx = MONTHS.indexOf(target.month)
    const entryDate = `${target.year}-${String(mIdx + 1).padStart(2, '0')}-${String(target.day).padStart(2, '0')}`
    if (patch.isCompleted) {
      const todayIso = new Date().toISOString().slice(0, 10)
      completedMap[id] = todayIso
    } else {
      delete completedMap[id]
    }
    saveCompletedDevotionalMap(completedMap)

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user?.id
        if (!uid || !supabase) return
        if (patch.isCompleted) {
          supabase
            .from('devotional_progress')
            .upsert({
              user_id: uid,
              devotional_id: id,
              entry_date: entryDate,
              completed_at: new Date().toISOString(),
            })
            .then((res) => recordWriteOutcome('devotionals', res), (err) => recordWriteError('devotionals', err))
        } else {
          supabase
            .from('devotional_progress')
            .delete()
            .eq('user_id', uid)
            .eq('devotional_id', id)
            .then((res) => recordWriteOutcome('devotionals', res), (err) => recordWriteError('devotionals', err))
        }
      })
    }
  }

  if (typeof patch.isBookmarked === 'boolean') {
    const current = new Set(getBookmarkedDevotionalIds())
    if (patch.isBookmarked) current.add(id)
    else current.delete(id)
    saveBookmarkedDevotionalIds(Array.from(current))

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user?.id
        if (!uid || !supabase) return
        if (patch.isBookmarked) {
          supabase
            .from('bookmarks')
            .upsert({ user_id: uid, item_type: 'devotional', item_id: id })
            .then((res) => recordWriteOutcome('devotionals', res), (err) => recordWriteError('devotionals', err))
        } else {
          supabase
            .from('bookmarks')
            .delete()
            .eq('user_id', uid)
            .eq('item_type', 'devotional')
            .eq('item_id', id)
            .then((res) => recordWriteOutcome('devotionals', res), (err) => recordWriteError('devotionals', err))
        }
      })
    }
  }

  return getDevotionals()
}

export const deleteDevotional = (id: string) => {
  const custom = loadCustomDevotionals().filter((d) => d.id !== id)
  persist(DEVOTIONALS_KEY, custom)
  return getDevotionals()
}

const LEGACY_SEEDED_HYMN_IDS = new Set(
  Array.from({ length: 15 }, (_, i) => `hymn-${i + 1}`)
)

export const getHymns = (): Hymn[] => {
  const favs = new Set(getFavoriteHymnIds())
  let custom: Hymn[] = []
  try {
    const raw = localStorage.getItem(HYMNS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      custom = parsed.filter((h: Hymn) => h && !LEGACY_SEEDED_HYMN_IDS.has(h.id))
    }
  } catch { /* ignore */ }
  return [...custom, ...HYMN_CONTENT].map((h) => ({
    ...h,
    isFavorite: favs.has(h.id),
  }))
}

export const saveHymns = (items: Hymn[]) => {
  const favs = items.filter((h) => h.isFavorite).map((h) => h.id)
  saveFavoriteHymnIds(favs)
}

export const addHymn = (item: Hymn) => {
  const updated = [item, ...getHymns()]
  persist(HYMNS_KEY, updated)
  return getHymns()
}

export const updateHymn = (id: string, patch: Partial<Hymn>) => {
  if (typeof patch.isFavorite === 'boolean') {
    const favs = new Set(getFavoriteHymnIds())
    if (patch.isFavorite) favs.add(id)
    else favs.delete(id)
    saveFavoriteHymnIds(Array.from(favs))

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user?.id
        if (!uid || !supabase) return
        if (patch.isFavorite) {
          supabase
            .from('bookmarks')
            .upsert({ user_id: uid, item_type: 'hymn', item_id: id })
            .then((res) => recordWriteOutcome('devotionals', res), (err) => recordWriteError('devotionals', err))
        } else {
          supabase
            .from('bookmarks')
            .delete()
            .eq('user_id', uid)
            .eq('item_type', 'hymn')
            .eq('item_id', id)
            .then((res) => recordWriteOutcome('devotionals', res), (err) => recordWriteError('devotionals', err))
        }
      })
    }
  }
  return getHymns()
}

export const deleteHymn = (id: string) => {
  const updated = getHymns().filter(h => h.id !== id)
  saveHymns(updated)
  return updated
}

// Seeded hymns removed so all hymns are managed fresh by the admin CMS.
const HYMN_CONTENT: Hymn[] = []