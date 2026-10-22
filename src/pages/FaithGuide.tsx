import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Send,
  Sparkles,
  ChevronLeft,
  BookOpen,
  Scale,
  HelpCircle,
  Link2,
  AlertTriangle,
  PenLine,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { addJournalEntry } from '@/data/journalData';
import {
  StudyMode,
  StructuredStudyResponse,
  generateFaithGuideStudy,
  isRemoteFaithGuideConfigured,
  CURATED_BIBLE_STUDIES,
} from '@/lib/faithGuideEngine';

const STUDY_MODES: { key: StudyMode; label: string; icon: React.ElementType }[] = [
  { key: 'passage', label: 'Passage Study', icon: BookOpen },
  { key: 'topic', label: 'Topical Study', icon: Scale },
  { key: 'crossref', label: 'Cross-Refs', icon: Link2 },
  { key: 'questions', label: 'Study Questions', icon: HelpCircle },
];

const QUICK_STUDIES = [
  { label: 'Ephesians 2:8-10 (Grace & Works)', query: 'Explain Ephesians 2:8-10 on grace and works', mode: 'passage' as StudyMode },
  { label: 'Peace in Anxiety (Phil 4:6-7)', query: 'Philippians 4:6-7 overcoming anxiety and worry', mode: 'topic' as StudyMode },
  { label: 'Baptism & Communion Views', query: 'Explain Christian views on baptism and communion', mode: 'topic' as StudyMode },
  { label: 'Holy Spirit & Gifts (1 Cor 12)', query: '1 Corinthians 12 spiritual gifts and fruit of the Spirit', mode: 'crossref' as StudyMode },
  { label: 'Wisdom & Trials (Romans 8:28)', query: 'Romans 8:28 and Proverbs 3:5-6 wisdom in trials', mode: 'questions' as StudyMode },
];

export function FaithGuide() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<StudyMode>('passage');
  const [translation, setTranslation] = useState<'KJV' | 'WEB'>('KJV');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [studies, setStudies] = useState<StructuredStudyResponse[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const remoteConfigured = isRemoteFaithGuideConfigured();

  // Load initial sample study on mount so the user immediately sees the structured layout
  useEffect(() => {
    let active = true;
    generateFaithGuideStudy('Ephesians 2:8-10 salvation by grace and good works', 'passage', 'KJV').then((res) => {
      if (active) setStudies([res]);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [studies, loading]);

  const handleRunStudy = async (customQuery?: string, customMode?: StudyMode) => {
    const q = (customQuery ?? input).trim();
    const activeMode = customMode ?? mode;
    if (!q || loading) return;

    setLoading(true);
    if (!customQuery) setInput('');

    try {
      const response = await generateFaithGuideStudy(q, activeMode, translation);
      setStudies((prev) => [...prev, response]);
    } catch {
      toast.error('Could not complete Bible study lookup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInBible = (book: string, chapter: number) => {
    localStorage.setItem('bible_target_jump', JSON.stringify({ book, chapter }));
    navigate('/bible');
  };

  const handleSaveStudyToJournal = (study: StructuredStudyResponse) => {
    const quotesBlock = study.scriptureQuotes
      .map((q) => `"${q.text}" — ${q.reference} (${q.translation})`)
      .join('\n\n');
    const questionsBlock = [
      `1. Observation: ${study.studyQuestions.observation}`,
      `2. Interpretation: ${study.studyQuestions.interpretation}`,
      `3. Application: ${study.studyQuestions.application}`,
    ].join('\n');

    addJournalEntry({
      title: `Bible Study: ${study.topicTitle}`,
      body: `Scripture Text:\n${quotesBlock}\n\nHistorical & Exegetical Context:\n${study.exegeticalContext}\n\nStudy Questions:\n${questionsBlock}`,
      type: 'Notes',
      scriptureRef: study.scriptureQuotes[0]?.reference,
    });
    toast.success('Saved structured study worksheet to your Journal!');
    navigate('/journal');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col max-w-md mx-auto border-x border-border/50">
      {/* Header */}
      <header className="px-4 py-3 bg-primary text-primary-foreground shadow-lg space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 h-8 w-8"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shadow-inner shrink-0">
              <Sparkles className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-base font-serif font-bold leading-tight">Scripture-Grounded Faith Guide</h1>
              <p className="text-[10px] opacity-85">
                Verifiable Scripture • Exegesis • Denominational Nuance
              </p>
            </div>
          </div>

          <button
            onClick={() => setTranslation((t) => (t === 'KJV' ? 'WEB' : 'KJV'))}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-bold uppercase tracking-wider"
            title="Switch Scripture Translation"
          >
            {translation}
          </button>
        </div>

        {/* Transparent Backend / Fallback Disclosure Banner */}
        <div
          className={cn(
            'px-3 py-1.5 rounded-lg text-[10px] flex items-center justify-between gap-2',
            remoteConfigured ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/20 text-amber-100'
          )}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 shrink-0" />
            {remoteConfigured
              ? 'Connected to Server-Side Faith Guide Study API'
              : 'Development Fallback: Local Curated Concordance + Live Scripture Verifier (No AI Backend Configured)'}
          </span>
        </div>

        {/* Study Mode Selector Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-black/20 p-1 rounded-xl">
          {STUDY_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all',
                mode === m.key ? 'bg-accent text-accent-foreground shadow-sm' : 'text-white/75 hover:text-white'
              )}
            >
              <m.icon className="w-3.5 h-3.5" />
              <span className="truncate max-w-full">{m.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Structured Study Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
        {studies.map((study) => (
          <Card key={study.id} className="border-border/60 shadow-md overflow-hidden">
            <CardContent className="p-4 space-y-4">
              {/* Query & Source Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    Inquiry: “{study.query}”
                  </span>
                  <h2 className="text-base font-serif font-bold text-primary mt-0.5">{study.topicTitle}</h2>
                </div>
                <Badge
                  variant={study.sourceMode === 'remote-ai-backend' ? 'default' : 'secondary'}
                  className="text-[9px] shrink-0"
                >
                  {study.sourceMode === 'remote-ai-backend' ? 'Verified AI Backend' : 'Curated Concordance'}
                </Badge>
              </div>

              {/* Section 1: Verbatim Scripture Quotations (Strictly Separated from Interpretation) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> 1. Direct Scripture Text (Verifiable)
                  </h3>
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase">Public Domain</span>
                </div>

                {study.scriptureQuotes.map((q) => (
                  <div
                    key={q.reference}
                    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-primary">
                        {q.reference} ({q.translation})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {q.verifiedSource === 'bible-api-live'
                            ? 'Live Bible API'
                            : q.verifiedSource === 'indexeddb-offline-cache'
                            ? 'Offline Cache'
                            : 'Verified Text'}
                        </Badge>
                        <button
                          onClick={() => handleOpenInBible(q.book, q.chapter)}
                          className="text-[10px] font-bold text-accent hover:underline"
                        >
                          Read Ch. {q.chapter} →
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-serif italic leading-relaxed text-foreground">“{q.text}”</p>
                  </div>
                ))}
              </div>

              {/* Explicit Distinction Banner */}
              <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{study.commentaryDistinctionNote}</span>
              </div>

              {/* Section 2: Historical & Exegetical Context */}
              {(mode === 'passage' || mode === 'topic') && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-accent" /> 2. Historical & Literary Context (Study Note)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{study.exegeticalContext}</p>
                </div>
              )}

              {/* Section 3: Consensus & Denominational Perspectives */}
              <div className="space-y-2.5 pt-1 border-t border-border/30">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-accent" /> 3. Christian Consensus & Denominational Perspectives
                </h3>
                <div className="p-2.5 rounded-lg bg-secondary/40 text-xs">
                  <strong className="text-primary">Historic Christian Consensus: </strong>
                  <span className="text-muted-foreground">{study.consensusStatement}</span>
                </div>

                <div className="space-y-2">
                  {study.denominationalPerspectives.map((dp) => (
                    <div key={dp.tradition} className="p-2.5 rounded-lg border border-border/50 bg-card text-xs space-y-1">
                      <p className="font-bold text-primary">{dp.tradition}</p>
                      <p className="text-muted-foreground leading-relaxed">{dp.summary}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] italic text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                  <strong>Acknowledging Uncertainty:</strong> {study.uncertaintyNote}
                </p>
              </div>

              {/* Section 4: Verifiable Cross-References */}
              <div className="space-y-2 pt-1 border-t border-border/30">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-accent" /> 4. Cross-References for Deeper Study
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {study.crossReferences.map((cr) => (
                    <button
                      key={cr.reference}
                      onClick={() => handleOpenInBible(cr.book, cr.chapter)}
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 text-left transition-colors"
                    >
                      <div>
                        <span className="text-xs font-bold text-primary">{cr.reference}</span>
                        <p className="text-[11px] text-muted-foreground">{cr.theme}</p>
                      </div>
                      <span className="text-[10px] font-bold text-accent shrink-0">Open →</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 5: Personal Study Questions */}
              <div className="space-y-2 pt-1 border-t border-border/30">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-accent" /> 5. Inductive Study Questions
                </h3>
                <div className="space-y-1.5 text-xs bg-secondary/20 p-3 rounded-xl">
                  <p>
                    <strong className="text-primary">Observation:</strong>{' '}
                    <span className="text-muted-foreground">{study.studyQuestions.observation}</span>
                  </p>
                  <p>
                    <strong className="text-primary">Interpretation:</strong>{' '}
                    <span className="text-muted-foreground">{study.studyQuestions.interpretation}</span>
                  </p>
                  <p>
                    <strong className="text-primary">Application:</strong>{' '}
                    <span className="text-muted-foreground">{study.studyQuestions.application}</span>
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => handleSaveStudyToJournal(study)}
                >
                  <PenLine className="w-3.5 h-3.5 text-primary" /> Save Study Worksheet to Journal
                </Button>
              </div>

              {/* Pastoral Disclaimer */}
              <p className="text-[10px] text-muted-foreground/80 border-t border-border/30 pt-2 leading-relaxed">
                {study.pastoralDisclaimer}
              </p>
            </CardContent>
          </Card>
        ))}

        {loading && (
          <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
            Verifying Scripture references and preparing structured study notes...
          </div>
        )}
      </div>

      {/* Footer Quick Prompts & Input */}
      <div className="p-3 bg-card border-t border-border/50 space-y-2.5">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {QUICK_STUDIES.map((item) => (
            <Button
              key={item.label}
              variant="outline"
              size="sm"
              onClick={() => {
                setMode(item.mode);
                handleRunStudy(item.query, item.mode);
              }}
              className="whitespace-nowrap rounded-full border-primary/20 text-primary hover:bg-primary/5 text-[11px] h-7 px-2.5 font-semibold"
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={`Enter passage (e.g. "John 3:16") or topic (${CURATED_BIBLE_STUDIES.length} curated themes)...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRunStudy()}
            className="flex-1 h-10 bg-muted/50 border-none rounded-xl text-xs"
          />
          <Button
            size="icon"
            onClick={() => handleRunStudy()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl shadow-md bg-primary hover:bg-primary/90"
            aria-label="Submit Bible study query"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
