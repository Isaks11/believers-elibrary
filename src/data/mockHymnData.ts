import { Hymn } from '@/types/devotional-hymn'

const HYMNS_KEY = 'gebeya-hymns'

export const HYMN_SEED: Hymn[] = [
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

export const getHymns = () => load<Hymn[]>(HYMNS_KEY, () => HYMN_SEED)
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