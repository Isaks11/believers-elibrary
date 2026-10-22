/**
 * Scripture-Grounded Faith Guide Engine (Phase 3 — Stage 1)
 *
 * Security & Integrity Principles:
 * 1. Never store or expose LLM API keys in browser code.
 * 2. Only call a server-side endpoint (`VITE_FAITH_GUIDE_API_URL` or Supabase Edge Function `faith-guide`)
 *    when explicitly configured.
 * 3. When no backend AI endpoint is configured, operate in a transparently labelled
 *    "Local Curated Concordance & Study Engine" mode — never pretending responses come from a live LLM.
 * 4. Strictly separate:
 *    - Direct Verifiable Scripture Quotations (with translation & book/chapter/verse citation)
 *    - Biblical Context & Exegetical Commentary (human/study interpretation)
 *    - Denominational & Theological Perspectives (fairly explaining historic Christian views & uncertainty)
 *    - Observation, Interpretation, and Application Study Questions
 * 5. Never fabricate scripture references or verse text.
 */

import { supabase } from '@/lib/supabase';
import { BIBLE_BOOKS } from '@/pages/Bible';

export type StudyMode = 'passage' | 'topic' | 'crossref' | 'questions';

export interface VerifiableScriptureQuote {
  reference: string;
  book: string;
  chapter: number;
  verses: string;
  translation: 'KJV' | 'WEB';
  text: string;
  verifiedSource: 'built-in-concordance' | 'indexeddb-offline-cache' | 'bible-api-live';
}

export interface DenominationalPerspective {
  tradition: string;
  summary: string;
}

export interface StructuredStudyResponse {
  id: string;
  query: string;
  mode: StudyMode;
  topicTitle: string;
  sourceMode: 'remote-ai-backend' | 'local-curated-concordance';
  scriptureQuotes: VerifiableScriptureQuote[];
  exegeticalContext: string;
  commentaryDistinctionNote: string;
  consensusStatement: string;
  denominationalPerspectives: DenominationalPerspective[];
  uncertaintyNote: string;
  crossReferences: {
    reference: string;
    book: string;
    chapter: number;
    theme: string;
  }[];
  studyQuestions: {
    observation: string;
    interpretation: string;
    application: string;
  };
  pastoralDisclaimer: string;
  createdAt: string;
}

export interface CuratedTopicStudy {
  id: string;
  keywords: string[];
  title: string;
  scriptureQuotes: VerifiableScriptureQuote[];
  exegeticalContext: string;
  consensusStatement: string;
  denominationalPerspectives: DenominationalPerspective[];
  uncertaintyNote: string;
  crossReferences: {
    reference: string;
    book: string;
    chapter: number;
    theme: string;
  }[];
  studyQuestions: {
    observation: string;
    interpretation: string;
    application: string;
  };
}

const PASTORAL_DISCLAIMER =
  'Pastoral & Study Disclaimer: This tool provides structured Bible study notes and public-domain Scripture citations. Commentary and theological summaries are human/study interpretations, not infallible Scripture, and are not a substitute for local church fellowship, pastoral counsel, or licensed mental-health and medical care.';

export const CURATED_BIBLE_STUDIES: CuratedTopicStudy[] = [
  {
    id: 'grace-salvation',
    keywords: ['grace', 'salvation', 'saved', 'faith', 'works', 'justification', 'ephesians 2', 'romans 3', 'forgive'],
    title: 'Salvation by Grace Through Faith & the Role of Good Works',
    scriptureQuotes: [
      {
        reference: 'Ephesians 2:8-10',
        book: 'Ephesians',
        chapter: 2,
        verses: '8-10',
        translation: 'KJV',
        text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast. For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in them.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: 'Romans 3:23-24',
        book: 'Romans',
        chapter: 3,
        verses: '23-24',
        translation: 'KJV',
        text: 'For all have sinned, and come short of the glory of God; Being justified freely by his grace through the redemption that is in Christ Jesus.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: 'James 2:17',
        book: 'James',
        chapter: 2,
        verses: '17',
        translation: 'KJV',
        text: 'Even so faith, if it hath not works, is dead, being alone.',
        verifiedSource: 'built-in-concordance',
      },
    ],
    exegeticalContext:
      'In Ephesians 2, Paul addresses Gentile and Jewish believers to show that neither ritual observance nor human merit initiates salvation; rescue from spiritual death is wholly a gift of God’s grace received through faith. In James 2, James addresses a different pastoral problem—verbal profession devoid of love or obedience—showing that genuine saving faith naturally bears fruit in action.',
    consensusStatement:
      'Across historic Christian orthodoxy, believers agree that salvation originates in God’s unmerited grace through the atoning work of Jesus Christ, and that a transformed life of love and good works is the expected fruit of the Holy Spirit.',
    denominationalPerspectives: [
      {
        tradition: 'Reformed & Lutheran Traditions',
        summary:
          'Emphasize monergistic regeneration and forensic justification by faith alone (sola fide), viewing good works as the necessary fruit and evidence of justification rather than its instrument.',
      },
      {
        tradition: 'Wesleyan / Arminian Traditions',
        summary:
          'Emphasize prevenient grace enabling all people to respond in faith, justification by faith, and ongoing sanctification (holiness of heart and life) empowered by the Spirit.',
      },
      {
        tradition: 'Catholic & Orthodox Traditions',
        summary:
          'View justification and sanctification (theosis) as an ongoing, transformative process initiated by grace in which faith works through love (Galatians 5:6).',
      },
    ],
    uncertaintyNote:
      'While Christians universally affirm God’s grace in Christ, faithful interpreters have debated for centuries the precise philosophical relationship between divine sovereignty, human free response, and perseverance.',
    crossReferences: [
      { reference: 'Romans 5:1', book: 'Romans', chapter: 5, theme: 'Peace with God through justification by faith' },
      { reference: 'Titus 3:5', book: 'Titus', chapter: 3, theme: 'Saved according to His mercy, not righteous deeds' },
      { reference: 'Galatians 2:20', book: 'Galatians', chapter: 2, theme: 'Crucified with Christ and living by faith' },
    ],
    studyQuestions: {
      observation: 'According to Ephesians 2:8-10, what is the cause of salvation, and what is the purpose for which believers are created in Christ Jesus?',
      interpretation: 'How do Paul’s teaching in Ephesians 2:8-9 and James’s teaching in James 2:17 complement rather than contradict each other?',
      application: 'Where are you tempted either to rely on your own performance for God’s approval or to neglect practical love for your neighbor?',
    },
  },
  {
    id: 'anxiety-peace',
    keywords: ['anxiety', 'anxious', 'peace', 'worry', 'fear', 'stress', 'philippians 4', 'psalm 23', 'psalms 23', 'trouble'],
    title: 'God’s Peace in Seasons of Anxiety and Uncertainty',
    scriptureQuotes: [
      {
        reference: 'Philippians 4:6-7',
        book: 'Philippians',
        chapter: 4,
        verses: '6-7',
        translation: 'KJV',
        text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: 'Psalms 23:1-4',
        book: 'Psalms',
        chapter: 23,
        verses: '1-4',
        translation: 'KJV',
        text: 'The LORD is my shepherd; I shall not want... Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.',
        verifiedSource: 'built-in-concordance',
      },
    ],
    exegeticalContext:
      'Paul wrote Philippians from Roman custody while facing an uncertain legal outcome. The Greek verb translated "keep" or "guard" (phroureō) in Philippians 4:7 is a military term picturing a garrison standing watch over a city’s gates—promising that God’s presence guards the believer’s inner life even when external circumstances remain difficult.',
    consensusStatement:
      'All Christian traditions affirm that God invites believers to bring honest lament, fear, and petition into His presence, and that Christ’s peace is rooted in God’s nearness rather than the absence of trials.',
    denominationalPerspectives: [
      {
        tradition: 'Contemplative & Liturgical Traditions',
        summary:
          'Often emphasize structured daily prayer, the Psalms of lament, and quiet meditation on Scripture to anchor the mind in God’s peace.',
      },
      {
        tradition: 'Evangelical & Pastoral Counseling Perspectives',
        summary:
          'Emphasize combining prayerful trust in Scripture with wise stewardship of the body, community support, and professional medical or counseling care when needed.',
      },
    ],
    uncertaintyNote:
      'Experiencing clinical anxiety or grief does not mean a believer lacks faith; Scripture itself records faithful servants (such as David in the Psalms, Elijah in 1 Kings 19, and Paul in 2 Corinthians 1:8) experiencing deep distress.',
    crossReferences: [
      { reference: 'John 14:27', book: 'John', chapter: 14, theme: 'Christ’s peace given to troubled hearts' },
      { reference: '1 Peter 5:7', book: '1 Peter', chapter: 5, theme: 'Casting all anxieties on God because He cares' },
      { reference: 'Isaiah 41:10', book: 'Isaiah', chapter: 41, theme: 'God’s promise to strengthen and uphold' },
    ],
    studyQuestions: {
      observation: 'What three practices does Paul pair together in Philippians 4:6 when bringing requests to God?',
      interpretation: 'Why does Psalm 23 describe walking "through" the valley of deep darkness rather than being airlifted around it?',
      application: 'What specific worry can you turn into a written prayer of petition and thanksgiving today?',
    },
  },
  {
    id: 'baptism-sacraments',
    keywords: ['baptism', 'baptize', 'water', 'infant', 'believer', 'communion', 'eucharist', 'lord supper', 'ordinance', 'sacrament'],
    title: 'Baptism & the Lord’s Supper Across Christian Traditions',
    scriptureQuotes: [
      {
        reference: 'Matthew 28:19-20',
        book: 'Matthew',
        chapter: 28,
        verses: '19-20',
        translation: 'KJV',
        text: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: Teaching them to observe all things whatsoever I have commanded you.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: 'Romans 6:3-4',
        book: 'Romans',
        chapter: 6,
        verses: '3-4',
        translation: 'KJV',
        text: 'Know ye not, that so many of us as were baptized into Jesus Christ were baptized into his death? Therefore we are buried with him by baptism into death: that like as Christ was raised up from the dead by the glory of the Father, even so we also should walk in newness of life.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: '1 Corinthians 11:23-26',
        book: '1 Corinthians',
        chapter: 11,
        verses: '23-26',
        translation: 'KJV',
        text: 'For as often as ye eat this bread, and drink this cup, ye do shew the Lord’s death till he come.',
        verifiedSource: 'built-in-concordance',
      },
    ],
    exegeticalContext:
      'Jesus instituted both baptism (Matthew 28:19) and the Lord’s Supper (Luke 22:19-20; 1 Corinthians 11:23-26) as visible, embodied practices uniting believers to His death and resurrection and to the visible Church.',
    consensusStatement:
      'Virtually all Christian churches practice baptism in the triune name of the Father, Son, and Holy Spirit and celebrate the Lord’s Table in remembrance and proclamation of Christ’s sacrifice.',
    denominationalPerspectives: [
      {
        tradition: 'Credobaptist Traditions (Baptist, Pentecostal, many Non-Denominational)',
        summary:
          'Practice believer’s baptism by immersion upon a personal profession of faith, viewing baptism and the Lord’s Supper primarily as ordinances of obedient testimony and remembrance.',
      },
      {
        tradition: 'Covenantal Paedobaptist Traditions (Presbyterian, Reformed, Methodist, Anglican)',
        summary:
          'Baptize both professing believers and the children of believers as a sign and seal of God’s covenant of grace (paralleling circumcision in the Old Testament and household baptisms in Acts 16), and view Christ as spiritually present in the Lord’s Supper.',
      },
      {
        tradition: 'Sacramental / Liturgical Traditions (Lutheran, Catholic, Orthodox)',
        summary:
          'Understand baptism and the Eucharist as means of grace through which God objectively conveys forgiveness and spiritual life, and affirm the real presence of Christ in the Eucharist.',
      },
    ],
    uncertaintyNote:
      'The New Testament commands baptism and the Lord’s Supper clearly, but devout, Scripture-honoring Christians differ on mode (immersion, pouring, sprinkling), timing (professing believers only vs. covenant households), and sacramental metaphysics.',
    crossReferences: [
      { reference: 'Acts 2:38-41', book: 'Acts', chapter: 2, theme: 'Repentance, baptism, and fellowship at Pentecost' },
      { reference: 'Acts 16:14-15', book: 'Acts', chapter: 16, theme: 'Lydia and her household baptized' },
      { reference: 'Colossians 2:11-12', book: 'Colossians', chapter: 2, theme: 'Buried and raised with Christ through faith' },
    ],
    studyQuestions: {
      observation: 'What imagery does Paul use in Romans 6:3-4 to describe the meaning of baptism?',
      interpretation: 'Why do both Credobaptist and Paedobaptist Christians appeal to Scripture to support their understanding of baptism?',
      application: 'How can remembering your baptism and coming to the Lord’s Table strengthen unity and humility toward believers from other traditions?',
    },
  },
  {
    id: 'holy-spirit-gifts',
    keywords: ['holy spirit', 'spiritual gifts', 'tongues', 'prophecy', 'healing', 'miracles', '1 corinthians 12', '1 corinthians 13', 'galatians 5', 'fruit of the spirit'],
    title: 'The Person, Fruit, and Gifts of the Holy Spirit',
    scriptureQuotes: [
      {
        reference: 'Galatians 5:22-23',
        book: 'Galatians',
        chapter: 5,
        verses: '22-23',
        translation: 'KJV',
        text: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, Meekness, temperance: against such there is no law.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: '1 Corinthians 12:4-7',
        book: '1 Corinthians',
        chapter: 12,
        verses: '4-7',
        translation: 'KJV',
        text: 'Now there are diversities of gifts, but the same Spirit... But the manifestation of the Spirit is given to every man to profit withal.',
        verifiedSource: 'built-in-concordance',
      },
    ],
    exegeticalContext:
      'In 1 Corinthians 12–14, Paul addresses a church divided over dramatic spiritual manifestations. He places chapter 13—the supreme call to Christlike love—directly between his discussions of spiritual gifts to show that gifts without love profit nothing.',
    consensusStatement:
      'All orthodox Christians confess the Holy Spirit as the third Person of the Trinity who regenerates, indwells, sanctifies, produces Christlike fruit, and equips believers for service.',
    denominationalPerspectives: [
      {
        tradition: 'Continuationist & Charismatic / Pentecostal Traditions',
        summary:
          'Affirm that all spiritual gifts listed in 1 Corinthians 12 (including prophecy, healing, and tongues) continue today for the edification of the Church when practiced in biblical order.',
      },
      {
        tradition: 'Cessationist Traditions',
        summary:
          'Hold that miraculous sign gifts (such as apostolic tongues and revelatory prophecy) served as foundational authentication during the apostolic era before the completion of the New Testament canon, while God still answers prayer sovereignly today.',
      },
    ],
    uncertaintyNote:
      'Christians agree that the fruit of the Spirit (love, joy, peace, patience, kindness) is the primary mark of spiritual maturity, while differing on how specific charismatic gifts operate today.',
    crossReferences: [
      { reference: '1 Corinthians 13:1-8', book: '1 Corinthians', chapter: 13, theme: 'The supremacy of love over all gifts' },
      { reference: 'Romans 8:14-16', book: 'Romans', chapter: 8, theme: 'Led by the Spirit as adopted children of God' },
      { reference: 'Acts 1:8', book: 'Acts', chapter: 1, theme: 'Empowered by the Holy Spirit to be Christ’s witnesses' },
    ],
    studyQuestions: {
      observation: 'According to 1 Corinthians 12:7, why does the Spirit distribute gifts to believers?',
      interpretation: 'Why does Paul place 1 Corinthians 13 (the chapter on love) right in the middle of his teaching on spiritual gifts?',
      application: 'Which aspect of the fruit of the Spirit in Galatians 5:22-23 are you asking God to cultivate in your relationships this week?',
    },
  },
  {
    id: 'wisdom-suffering-providence',
    keywords: ['suffering', 'pain', 'why', 'purpose', 'romans 8', 'proverbs 3', 'wisdom', 'guidance', 'will of god', 'trials', 'james 1'],
    title: 'God’s Wisdom, Guidance, and Providence in Trials',
    scriptureQuotes: [
      {
        reference: 'Proverbs 3:5-6',
        book: 'Proverbs',
        chapter: 3,
        verses: '5-6',
        translation: 'KJV',
        text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: 'Romans 8:28',
        book: 'Romans',
        chapter: 8,
        verses: '28',
        translation: 'KJV',
        text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
        verifiedSource: 'built-in-concordance',
      },
      {
        reference: 'James 1:5',
        book: 'James',
        chapter: 1,
        verses: '5',
        translation: 'KJV',
        text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.',
        verifiedSource: 'built-in-concordance',
      },
    ],
    exegeticalContext:
      'In Romans 8:28-29, the "good" toward which God works all things is explicitly defined in verse 29: being "conformed to the image of his Son." Biblical wisdom literature (Proverbs, Job, Ecclesiastes) teaches both that God’s moral order is wise and that righteous people sometimes suffer in ways that exceed human explanation on this side of eternity.',
    consensusStatement:
      'Christians across traditions affirm that God is wise, loving, and sovereign, that He hears the cries of the suffering, and that in Christ suffering will ultimately be redeemed in resurrection glory.',
    denominationalPerspectives: [
      {
        tradition: 'Reformed Providence Perspective',
        summary:
          'Emphasizes God’s meticulous sovereignty over all events, trusting that no trial is random or outside the Father’s wise decree.',
      },
      {
        tradition: 'Arminian / Free-Will Theodicy Perspective',
        summary:
          'Emphasizes that much suffering results from fallen human choices and a broken creation, while God actively works within history to redeem and comfort His people.',
      },
    ],
    uncertaintyNote:
      'Scripture warns against simplistic explanations for personal tragedy (as seen in Job’s friends). When someone is suffering, compassionate presence and prayer are more biblical than speculative answers.',
    crossReferences: [
      { reference: 'Psalms 34:18', book: 'Psalms', chapter: 34, theme: 'The Lord is nigh unto them that are of a broken heart' },
      { reference: '2 Corinthians 12:9', book: '2 Corinthians', chapter: 12, theme: 'My grace is sufficient for thee' },
      { reference: '1 Peter 1:6-7', book: '1 Peter', chapter: 1, theme: 'Faith tested and refined through trials' },
    ],
    studyQuestions: {
      observation: 'How does Romans 8:29 define the ultimate "good" promised in Romans 8:28?',
      interpretation: 'What does Proverbs 3:5-6 contrast with "leaning on your own understanding"?',
      application: 'What decision or burden can you surrender to God’s wisdom in prayer today?',
    },
  },
];

/**
 * Parses a Bible passage reference from a query string if present (e.g., "John 3:16" or "Romans 8" or "Psalms 23").
 */
export function parseScriptureReferenceFromQuery(query: string): {
  book: string;
  chapter: number;
  verseSpec?: string;
} | null {
  const normalized = query.trim();
  if (!normalized) return null;

  // Sort books by name length descending so "1 Corinthians" matches before "Corinthians"
  const sortedBooks = [...BIBLE_BOOKS].sort((a, b) => b.name.length - a.name.length);
  for (const b of sortedBooks) {
    const escaped = b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\s+(\\d+)(?::(\\d+(?:-\\d+)?))?`, 'i');
    const match = normalized.match(regex);
    if (match) {
      const chap = parseInt(match[1], 10);
      if (chap >= 1 && chap <= b.chapters) {
        return {
          book: b.name,
          chapter: chap,
          verseSpec: match[2],
        };
      }
    }
  }
  return null;
}

/**
 * Attempts to fetch a real, verifiable scripture passage from local cache or bible-api.com.
 * Never fabricates text if offline or unfound.
 */
export async function fetchVerifiedPassageQuote(
  book: string,
  chapter: number,
  verseSpec?: string,
  translation: 'KJV' | 'WEB' = 'KJV'
): Promise<VerifiableScriptureQuote | null> {
  const ref = verseSpec ? `${book} ${chapter}:${verseSpec}` : `${book} ${chapter}:1-5`;
  const cacheKey = `${book} ${chapter}:${translation}`;

  try {
    const rawCache = localStorage.getItem('bible_chapter_cache');
    if (rawCache) {
      const parsed = JSON.parse(rawCache) as Record<string, string[]>;
      const verses = parsed[cacheKey];
      if (Array.isArray(verses) && verses.length > 0) {
        let sliceText = verses.slice(0, 5).join(' ');
        let usedSpec = '1-5';
        if (verseSpec) {
          const [startStr, endStr] = verseSpec.split('-');
          const start = Math.max(1, parseInt(startStr, 10) || 1);
          const end = endStr ? Math.min(verses.length, parseInt(endStr, 10) || start) : start;
          if (start <= verses.length) {
            sliceText = verses.slice(start - 1, end).join(' ');
            usedSpec = verseSpec;
          }
        }
        return {
          reference: `${book} ${chapter}:${usedSpec}`,
          book,
          chapter,
          verses: usedSpec,
          translation,
          text: sliceText,
          verifiedSource: 'indexeddb-offline-cache',
        };
      }
    }
  } catch {
    /* ignore cache parse error */
  }

  try {
    const apiUrl = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation.toLowerCase()}`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.text === 'string' && data.text.trim()) {
      return {
        reference: String(data.reference || ref),
        book,
        chapter,
        verses: verseSpec || '1-5',
        translation,
        text: data.text.trim().replace(/\s+/g, ' '),
        verifiedSource: 'bible-api-live',
      };
    }
  } catch {
    /* network unavailable */
  }

  return null;
}

/**
 * Checks whether a remote AI backend endpoint is configured.
 * Keys are never stored in browser code; only a server-side URL or Supabase Edge Function is permitted.
 */
export function isRemoteFaithGuideConfigured(): boolean {
  const envUrl = import.meta.env.VITE_FAITH_GUIDE_API_URL as string | undefined;
  return Boolean(envUrl && envUrl.trim().length > 0);
}

/**
 * Generates a structured, scripture-grounded Bible study response.
 * Uses a remote server endpoint if configured (`VITE_FAITH_GUIDE_API_URL`),
 * or transparently falls back to the local curated concordance & live passage verifier.
 */
export async function generateFaithGuideStudy(
  query: string,
  mode: StudyMode,
  preferredTranslation: 'KJV' | 'WEB' = 'KJV'
): Promise<StructuredStudyResponse> {
  const cleanQuery = query.trim();
  const qLower = cleanQuery.toLowerCase();

  // 1. Check if a server-side endpoint is configured (keeps API keys out of browser code)
  const remoteEndpoint = (import.meta.env.VITE_FAITH_GUIDE_API_URL as string | undefined)?.trim();
  if (remoteEndpoint) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      }
      const res = await fetch(remoteEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: cleanQuery, mode, translation: preferredTranslation }),
      });
      if (res.ok) {
        const payload = (await res.json()) as Partial<StructuredStudyResponse>;
        if (payload && payload.topicTitle && Array.isArray(payload.scriptureQuotes)) {
          return {
            id: `study-${Date.now()}`,
            query: cleanQuery,
            mode,
            topicTitle: payload.topicTitle,
            sourceMode: 'remote-ai-backend',
            scriptureQuotes: payload.scriptureQuotes,
            exegeticalContext: payload.exegeticalContext || '',
            commentaryDistinctionNote:
              'Note: Direct Scripture quotations above are verbatim biblical text. The context and theological notes below are AI-assisted study commentary and should be tested against Scripture (Acts 17:11).',
            consensusStatement: payload.consensusStatement || '',
            denominationalPerspectives: payload.denominationalPerspectives || [],
            uncertaintyNote: payload.uncertaintyNote || '',
            crossReferences: payload.crossReferences || [],
            studyQuestions: payload.studyQuestions || {
              observation: 'What key words or promises stand out in this passage?',
              interpretation: 'How does this passage fit within the broader story of Scripture?',
              application: 'How can you live out this truth in love and obedience today?',
            },
            pastoralDisclaimer: PASTORAL_DISCLAIMER,
            createdAt: new Date().toISOString(),
          };
        }
      }
    } catch {
      /* Fall through transparently to local curated concordance */
    }
  }

  // 2. Match against curated biblical studies
  let matchedTopic = CURATED_BIBLE_STUDIES[0];
  let bestScore = 0;

  for (const study of CURATED_BIBLE_STUDIES) {
    let score = 0;
    for (const kw of study.keywords) {
      if (qLower.includes(kw)) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      matchedTopic = study;
    }
  }

  // 3. Check if the user asked about a specific Bible passage (e.g. "John 3:16" or "Genesis 1")
  const parsedRef = parseScriptureReferenceFromQuery(cleanQuery);
  const quotes: VerifiableScriptureQuote[] = [];

  if (parsedRef) {
    const verifiedQuote = await fetchVerifiedPassageQuote(
      parsedRef.book,
      parsedRef.chapter,
      parsedRef.verseSpec,
      preferredTranslation
    );
    if (verifiedQuote) {
      quotes.push(verifiedQuote);
    }
  }

  // Append curated verified quotes if needed
  for (const cq of matchedTopic.scriptureQuotes) {
    if (!quotes.some((q) => q.reference === cq.reference)) {
      quotes.push(cq);
    }
  }

  const topicHeading =
    parsedRef && bestScore === 0
      ? `Passage Study: ${parsedRef.book} ${parsedRef.chapter}${parsedRef.verseSpec ? `:${parsedRef.verseSpec}` : ''}`
      : matchedTopic.title;

  const contextNote =
    parsedRef && bestScore === 0
      ? `You requested a study on ${parsedRef.book} ${parsedRef.chapter}${
          parsedRef.verseSpec ? `:${parsedRef.verseSpec}` : ''
        }. Read the direct Scripture text above in its surrounding chapter context before drawing doctrinal conclusions, comparing how ${
          parsedRef.book
        } contributes to the canon of Scripture.`
      : matchedTopic.exegeticalContext;

  return {
    id: `study-${Date.now()}`,
    query: cleanQuery,
    mode,
    topicTitle: topicHeading,
    sourceMode: 'local-curated-concordance',
    scriptureQuotes: quotes,
    exegeticalContext: contextNote,
    commentaryDistinctionNote:
      'Distinction Notice: Direct Scripture quotations are shown in the verified Scripture box above. The historical context, commentary, and denominational summaries below are curated human study notes — not Scripture itself.',
    consensusStatement: matchedTopic.consensusStatement,
    denominationalPerspectives: matchedTopic.denominationalPerspectives,
    uncertaintyNote: matchedTopic.uncertaintyNote,
    crossReferences: matchedTopic.crossReferences,
    studyQuestions: matchedTopic.studyQuestions,
    pastoralDisclaimer: PASTORAL_DISCLAIMER,
    createdAt: new Date().toISOString(),
  };
}
