import { DevotionalEntry, Hymn, BibleVersion, MONTHS, DAYS_OF_WEEK } from '@/types/devotional-hymn'

const DEVOTIONALS_KEY = 'gebeya-devotionals'
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

function buildSeedDevotionals(): DevotionalEntry[] {
  const entries: DevotionalEntry[] = []
  const yearByIndex = [2024, 2025, 2026]
  const today = new Date()
  let counter = 0

  yearByIndex.forEach((year) => {
    const startMonth = year === 2024 ? 5 : 0
    for (let m = startMonth; m < 12; m += 1) {
      const monthName = MONTHS[m]
      const daysInMonth = new Date(year, m + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d += 3) {
        const date = new Date(year, m, d)
        const dayOfWeek = DAYS_OF_WEEK[(date.getDay() + 6) % 7]
        const template = BODIES[counter % BODIES.length]
        const verse = VERSES[counter % VERSES.length]
        const isPast = date.getTime() < today.getTime()
        entries.push({
          id: `dev-${year}-${m + 1}-${d}`,
          year,
          month: monthName,
          day: d,
          dayOfWeek,
          title: template.title,
          theme: template.theme,
          scriptureRef: verse.ref,
          bibleVersions: { ...verse.texts },
          mainBody: template.mainBody,
          keyThought: template.keyThought,
          prayer: template.prayer,
          prayerPoints: template.prayerPoints,
          author: template.author,
          readTimeMinutes: 4 + (counter % 3),
          tags: template.tags,
          isCompleted: isPast ? counter % 2 === 0 : false,
          isBookmarked: false,
        })
        counter += 1
      }
    }
  })
  return entries
}

function load<T>(key: string, seed: () => T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* corrupted storage falls back to seed */
  }
  const seeded = seed()
  try { localStorage.setItem(key, JSON.stringify(seeded)) } catch { /* storage full */ }
  return seeded
}

function persist<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full */ }
}

export const getDevotionals = () => load<DevotionalEntry[]>(DEVOTIONALS_KEY, buildSeedDevotionals)
export const saveDevotionals = (items: DevotionalEntry[]) => persist(DEVOTIONALS_KEY, items)
export const addDevotional = (item: DevotionalEntry) => {
  const updated = [item, ...getDevotionals()]
  saveDevotionals(updated)
  return updated
}
export const updateDevotional = (id: string, patch: Partial<DevotionalEntry>) => {
  const updated = getDevotionals().map(d => (d.id === id ? { ...d, ...patch } : d))
  saveDevotionals(updated)
  return updated
}
export const deleteDevotional = (id: string) => {
  const updated = getDevotionals().filter(d => d.id !== id)
  saveDevotionals(updated)
  return updated
}

export const getHymns = () => load<Hymn[]>(HYMNS_KEY, () => HYMN_CONTENT)
export const saveHymns = (items: Hymn[]) => persist(HYMNS_KEY, items)
export const addHymn = (item: Hymn) => {
  const updated = [item, ...getHymns()]
  saveHymns(updated)
  return updated
}
export const updateHymn = (id: string, patch: Partial<Hymn>) => {
  const updated = getHymns().map(h => (h.id === id ? { ...h, ...patch } : h))
  saveHymns(updated)
  return updated
}
export const deleteHymn = (id: string) => {
  const updated = getHymns().filter(h => h.id !== id)
  saveHymns(updated)
  return updated
}

const HYMN_CONTENT: Hymn[] = [
  {
    id: 'hymn-1', number: 1, title: 'Amazing Grace', category: 'Grace', author: 'John Newton', yearWritten: '1779', tuneName: 'New Britain', keySignature: 'G', meter: '8.6.8.6',
    stanzas: [
      "Amazing grace, how sweet the sound, that saved a wretch like me. I once was lost, but now am found, was blind, but now I see.",
      "Twas grace that taught my heart to fear, and grace my fears relieved. How precious did that grace appear the hour I first believed.",
      "Through many dangers, toils, and snares, I have already come. Tis grace hath brought me safe thus far, and grace will lead me home.",
      "When we've been there ten thousand years, bright shining as the sun, we've no less days to sing God's praise than when we first begun.",
    ],
    chorus: "Amazing grace, how sweet the sound, that saved a wretch like me. I once was lost, but now am found, was blind, but now I see.",
  },
  {
    id: 'hymn-2', number: 2, title: 'Great Is Thy Faithfulness', category: 'Morning', author: 'Thomas Chisholm', yearWritten: '1923', tuneName: 'Faithfulness', keySignature: 'Eb', meter: '11.10.11.10',
    stanzas: [
      "Great is Thy faithfulness, O God my Father; there is no shadow of turning with Thee. Thou changest not, Thy compassions they fail not: as Thou hast been, Thou forever wilt be.",
      "Summer and winter and springtime and harvest, sun, moon, and stars in their courses above join with all nature in manifold witness to Thy great faithfulness, mercy, and love.",
      "Pardon for sin and a peace that endureth, Thine own dear presence to cheer and to guide, strength for today and bright hope for tomorrow, blessings all mine with ten thousand beside.",
    ],
    chorus: "Great is Thy faithfulness! Great is Thy faithfulness! Morning by morning new mercies I see. All I have needed Thy hand hath provided; great is Thy faithfulness, Lord unto me.",
  },
  {
    id: 'hymn-3', number: 3, title: 'It Is Well With My Soul', category: 'Assurance', author: 'Horatio Spafford', yearWritten: '1873', tuneName: 'Ville du Havre', keySignature: 'D', meter: '11.8.11.9',
    stanzas: [
      "When peace like a river attendeth my way, when sorrows like sea billows roll; whatever my lot, Thou hast taught me to say, it is well, it is well with my soul.",
      "Though Satan should buffet, though trials should come, let this blest assurance control: that Christ hath regarded my helpless estate, and hath shed His own blood for my soul.",
      "My sin, O the bliss of this glorious thought: my sin, not in part but the whole, is nailed to His cross, and I bear it no more. Praise the Lord, praise the Lord, O my soul!",
      "And Lord, haste the day when my faith shall be sight, the clouds be rolled back as a scroll; the trump shall resound, and the Lord shall descend, even so, it is well with my soul.",
    ],
    chorus: "It is well with my soul, it is well, it is well with my soul.",
  },
  {
    id: 'hymn-4', number: 4, title: 'How Great Thou Art', category: 'Worship', author: 'Carl Boberg', yearWritten: '1885', tuneName: 'O Store Gud', keySignature: 'Bb', meter: '11.10.11.10',
    stanzas: [
      "O Lord my God, when I in awesome wonder consider all the worlds Thy hands have made; I see the stars, I hear the rolling thunder, Thy power throughout the universe displayed.",
      "When through the woods and forest glades I wander and hear the birds sing sweetly in the trees; when I look down from lofty mountain grandeur and hear the brook and feel the gentle breeze.",
      "And when I think that God, His Son not sparing, sent Him to die, I scarce can take it in; that on the cross, my burden gladly bearing, He bled and died to take away my sin.",
      "When Christ shall come with shout of acclamation and take me home, what joy shall fill my heart! Then I shall bow in humble adoration and there proclaim, my God, how great Thou art!",
    ],
    chorus: "Then sings my soul, my Savior God to Thee: how great Thou art, how great Thou art! Then sings my soul, my Savior God to Thee: how great Thou art, how great Thou art!",
  },
  {
    id: 'hymn-5', number: 5, title: 'Holy, Holy, Holy', category: 'Worship', author: 'Reginald Heber', yearWritten: '1826', tuneName: 'Nicaea', keySignature: 'D', meter: '11.12.12.10',
    stanzas: [
      "Holy, holy, holy! Lord God Almighty! Early in the morning our song shall rise to Thee. Holy, holy, holy! Merciful and mighty! God in three Persons, blessed Trinity!",
      "Holy, holy, holy! All the saints adore Thee, casting down their golden crowns around the glassy sea; cherubim and seraphim falling down before Thee, which wert, and art, and evermore shalt be.",
      "Holy, holy, holy! Though the darkness hide Thee, though the eye of sinful man Thy glory may not see; only Thou art holy, there is none beside Thee, perfect in power, in love, and purity.",
      "Holy, holy, holy! Lord God Almighty! All Thy works shall praise Thy name in earth, and sky, and sea. Holy, holy, holy! Merciful and mighty! God in three Persons, blessed Trinity!",
    ],
  },
  {
    id: 'hymn-6', number: 6, title: 'Blessed Assurance', category: 'Assurance', author: 'Fanny Crosby', yearWritten: '1873', tuneName: 'Assurance', keySignature: 'D', meter: '9.10.9.9',
    stanzas: [
      "Blessed assurance, Jesus is mine! O what a foretaste of glory divine! Heir of salvation, purchase of God, born of His Spirit, washed in His blood.",
      "Perfect submission, perfect delight, visions of rapture now burst on my sight; angels descending bring from above echoes of mercy, whispers of love.",
      "Perfect submission, all is at rest; I in my Savior am happy and blest; watching and waiting, looking above, filled with His goodness, lost in His love.",
    ],
    chorus: "This is my story, this is my song, praising my Savior all the day long. This is my story, this is my song, praising my Savior all the day long.",
  },
  {
    id: 'hymn-7', number: 7, title: 'What A Friend We Have In Jesus', category: 'Faith', author: 'Joseph Scriven', yearWritten: '1855', tuneName: 'Erie', keySignature: 'F', meter: '8.7.8.7',
    stanzas: [
      "What a friend we have in Jesus, all our sins and griefs to bear! What a privilege to carry everything to God in prayer! O what peace we often forfeit, O what needless pain we bear, all because we do not carry everything to God in prayer!",
      "Have we trials and temptations? Is there trouble anywhere? We should never be discouraged: take it to the Lord in prayer. Can we find a friend so faithful, who will all our sorrows share? Jesus knows our every weakness: take it to the Lord in prayer.",
      "Are we weak and heavy laden, cumbered with a load of care? Precious Savior, still our refuge: take it to the Lord in prayer. Do thy friends despise, forsake thee? Take it to the Lord in prayer! In His arms He'll take and shield thee, thou wilt find a solace there.",
    ],
  },
  {
    id: 'hymn-8', number: 8, title: 'Rock of Ages', category: 'Grace', author: 'Augustus Toplady', yearWritten: '1763', tuneName: 'Toplady', keySignature: 'C', meter: '7.7.7.7',
    stanzas: [
      "Rock of Ages, cleft for me, let me hide myself in Thee; let the water and the blood, from Thy riven side which flowed, be of sin the double cure, save me from its guilt and power.",
      "Not the labors of my hands can fulfill Thy law's demands; could my zeal no respite know, could my tears forever flow, all for sin could not atone: Thou must save, and Thou alone.",
      "Nothing in my hand I bring, simply to Thy cross I cling; naked, come to Thee for dress; helpless, look to Thee for grace; foul, I to the fountain fly; wash me, Savior, or I die.",
      "While I draw this fleeting breath, when mine eyelids close in death, when I soar to worlds unknown, see Thee on Thy judgment throne: Rock of Ages, cleft for me, let me hide myself in Thee.",
    ],
  },
  {
    id: 'hymn-9', number: 9, title: 'Abide With Me', category: 'Evening', author: 'Henry Lyte', yearWritten: '1847', tuneName: 'Eventide', keySignature: 'Eb', meter: '10.10.10.10',
    stanzas: [
      "Abide with me; fast falls the eventide; the darkness deepens; Lord, with me abide. When other helpers fail and comforts flee, Help of the helpless, O abide with me.",
      "Swift to its close ebbs out life's little day; earth's joys grow dim, its glories pass away; change and decay in all around I see; O Thou who changest not, abide with me.",
      "I need Thy presence every passing hour; what but Thy grace can foil the tempter's power? Who like Thyself my guide and stay can be? Through cloud and sunshine, O abide with me.",
      "Hold Thou Thy cross before my closing eyes; shine through the gloom and point me to the skies; heaven's morning breaks and earth's vain shadows flee; in life, in death, O Lord, abide with me.",
    ],
  },
  {
    id: 'hymn-10', number: 10, title: 'All Creatures of Our God and King', category: 'Praise', author: 'Francis of Assisi', yearWritten: '1225', tuneName: 'Lasst Uns Erfreuen', keySignature: 'A', meter: '8.8.4.4.8.8',
    stanzas: [
      "All creatures of our God and King, lift up your voice and with us sing: Alleluia! Alleluia! Thou burning sun with golden beam, thou silver moon with softer gleam: O praise Him! O praise Him! Alleluia! Alleluia! Alleluia!",
      "Thou rushing wind that art so strong, ye clouds that sail in heaven along, O praise Him! Alleluia! Thou rising morn, in praise rejoice, ye lights of evening, find a voice: O praise Him! O praise Him! Alleluia! Alleluia! Alleluia!",
      "Let all things their Creator bless, and worship Him in humbleness: O praise Him! Alleluia! Praise, praise the Father, praise the Son, and praise the Spirit, Three in One: O praise Him! O praise Him! Alleluia! Alleluia! Alleluia!",
    ],
  },
  {
    id: 'hymn-11', number: 11, title: 'Be Thou My Vision', category: 'Faith', author: 'Dallan Forgaill', yearWritten: '800', tuneName: 'Slane', keySignature: 'G', meter: '10.10.10.10',
    stanzas: [
      "Be Thou my vision, O Lord of my heart; naught be all else to me, save that Thou art. Thou my best thought, by day or by night, waking or sleeping, Thy presence my light.",
      "Be Thou my wisdom, and Thou my true word; I ever with Thee and Thou with me, Lord; Thou my great Father, I Thy true son; Thou in me dwelling, and I with Thee one.",
      "Riches I heed not, nor man's empty praise, Thou mine inheritance, now and always; Thou and Thou only, first in my heart, high King of heaven, my treasure Thou art.",
      "High King of heaven, my victory won, may I reach heaven's joys, O bright heaven's Sun! Heart of my own heart, whatever befall, still be my vision, O Ruler of all.",
    ],
  },
  {
    id: 'hymn-12', number: 12, title: 'Come Thou Fount of Every Blessing', category: 'Thanksgiving', author: 'Robert Robinson', yearWritten: '1758', tuneName: 'Nettleton', keySignature: 'D', meter: '8.7.8.7',
    stanzas: [
      "Come, thou Fount of every blessing, tune my heart to sing thy grace; streams of mercy, never ceasing, call for songs of loudest praise. Teach me some melodious sonnet, sung by flaming tongues above. Praise the mount! I'm fixed upon it, mount of thy redeeming love.",
      "Here I raise mine Ebenezer; hither by thy help I'm come; and I hope, by thy good pleasure, safely to arrive at home. Jesus sought me when a stranger, wandering from the fold of God; he, to rescue me from danger, interposed his precious blood.",
      "O to grace how great a debtor daily I'm constrained to be! Let thy goodness, like a fetter, bind my wandering heart to thee. Prone to wander, Lord, I feel it, prone to leave the God I love; here's my heart, O take and seal it, seal it for thy courts above.",
    ],
  },
  {
    id: 'hymn-13', number: 13, title: 'Christ the Lord Is Risen Today', category: 'Easter', author: 'Charles Wesley', yearWritten: '1739', tuneName: 'Easter Hymn', keySignature: 'C', meter: '7.7.7.7',
    stanzas: [
      "Christ the Lord is risen today, Alleluia! Sons of men and angels say, Alleluia! Raise your joys and triumphs high, Alleluia! Sing, ye heavens, and earth reply, Alleluia!",
      "Love's redeeming work is done, Alleluia! Fought the fight, the battle won, Alleluia! Death in vain forbids Him rise, Alleluia! Christ hath opened paradise, Alleluia!",
      "Lives again our glorious King, Alleluia! Where, O death, is now thy sting? Alleluia! Once He died our souls to save, Alleluia! Where thy victory, O grave? Alleluia!",
    ],
  },
  {
    id: 'hymn-14', number: 14, title: 'O Come, All Ye Faithful', category: 'Christmas', author: 'John Francis Wade', yearWritten: '1743', tuneName: 'Adeste Fideles', keySignature: 'G', meter: 'Irregular',
    stanzas: [
      "O come, all ye faithful, joyful and triumphant, O come ye, O come ye to Bethlehem! Come and behold Him, born the King of angels!",
      "Sing, choirs of angels, sing in exultation; sing, all ye citizens of heaven above! Glory to God, all glory in the highest!",
      "Yea, Lord, we greet Thee, born this happy morning; Jesus, to Thee be all glory given; Word of the Father, now in flesh appearing!",
    ],
    chorus: "O come, let us adore Him, O come, let us adore Him, O come, let us adore Him, Christ the Lord!",
  },
  {
    id: 'hymn-15', number: 15, title: 'Joy to the World', category: 'Christmas', author: 'Isaac Watts', yearWritten: '1719', tuneName: 'Antioch', keySignature: 'D', meter: 'C.M.',
    stanzas: [
      "Joy to the world! The Lord is come: let earth receive her King! Let every heart prepare Him room, and heaven and nature sing, and heaven and nature sing, and heaven and heaven and nature sing.",
      "Joy to the earth! The Savior reigns: let men their songs employ; while fields and floods, rocks, hills, and plains repeat the sounding joy, repeat the sounding joy, repeat, repeat the sounding joy.",
      "No more let sins and sorrows grow, nor thorns infest the ground; He comes to make His blessings flow far as the curse is found, far as the curse is found, far as, far as the curse is found.",
      "He rules the world with truth and grace, and makes the nations prove the glories of His righteousness, and wonders of His love, and wonders of His love, and wonders, wonders of His love.",
    ],
  },
]