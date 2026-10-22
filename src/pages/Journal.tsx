import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  PenLine,
  Plus,
  Heart,
  Moon,
  FileText,
  Trash2,
  Search,
  Smile,
  CheckCircle2,
  Clock,
  BookOpen,
  Download,
  Lock,
  Unlock,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  JournalEntry,
  JournalType,
  JOURNAL_TYPES,
  PersonalPrayerRequest,
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  removeJournalEntry,
  getPersonalPrayers,
  addPersonalPrayer,
  togglePersonalPrayerStatus,
  removePersonalPrayer,
  getMoodLogs,
  setMoodLog,
  localDateKey,
  syncPersonalJournalFromServer,
} from '@/data/journalData';
import { exportAllUserData } from '@/lib/activity';
import {
  hasJournalPinConfigured,
  setJournalPin,
  verifyJournalPin,
  clearJournalPin,
} from '@/lib/securityAndSync';

const TYPE_META: Record<JournalType, { icon: React.ElementType; color: string }> = {
  Prayer: { icon: Heart, color: 'text-rose-500' },
  Gratitude: { icon: Smile, color: 'text-amber-500' },
  Dream: { icon: Moon, color: 'text-indigo-500' },
  Notes: { icon: FileText, color: 'text-slate-500' },
};

const PRAYER_CATEGORIES = ['Personal', 'Family', 'Health', 'Guidance', 'Church', 'Thanksgiving'];

const MOODS = ['🙏', '😊', '😔', '🕊️', '🔥'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function Journal() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[]>(() => getJournalEntries());
  const [prayers, setPrayers] = useState<PersonalPrayerRequest[]>(() => getPersonalPrayers());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<JournalType | null>(null);
  const [prayerStatusFilter, setPrayerStatusFilter] = useState<'all' | 'ongoing' | 'answered'>('all');
  const [moods, setMoods] = useState<Record<string, string>>(() => getMoodLogs());

  // Privacy PIN lock state (salted hash per user, never stored in plaintext)
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean>(() => hasJournalPinConfigured());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => !hasJournalPinConfigured());
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');

  // Journal Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<JournalType>('Prayer');
  const [scriptureRef, setScriptureRef] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Personal Prayer Editor state
  const [prayerDialogOpen, setPrayerDialogOpen] = useState(false);
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerBody, setPrayerBody] = useState('');
  const [prayerCategory, setPrayerCategory] = useState('Personal');
  const [prayerScripture, setPrayerScripture] = useState('');

  useEffect(() => {
    setEntries(getJournalEntries());
    setPrayers(getPersonalPrayers());
    setMoods(getMoodLogs());
    setHasPinConfigured(hasJournalPinConfigured());

    syncPersonalJournalFromServer().then((synced) => {
      setEntries(synced.entries);
      setPrayers(synced.prayers);
      setMoods(synced.moods);
    });
  }, []);

  const counts = useMemo(() => {
    const c: Record<JournalType, number> = { Prayer: 0, Gratitude: 0, Dream: 0, Notes: 0 };
    entries.forEach((e) => {
      if (c[e.type] !== undefined) c[e.type] += 1;
    });
    return c;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (!q) return true;
      if (e.isPrivate && !isUnlocked) return false;
      return (
        e.title.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        (e.scriptureRef ?? '').toLowerCase().includes(q)
      );
    });
  }, [entries, query, typeFilter, isUnlocked]);

  const visiblePrayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prayers.filter((p) => {
      if (prayerStatusFilter !== 'all' && p.status !== prayerStatusFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [prayers, query, prayerStatusFilter]);

  const openNew = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setType('Prayer');
    setScriptureRef('');
    setIsPrivate(false);
    setEditorOpen(true);
  };

  const openEdit = (entry: JournalEntry) => {
    if (entry.isPrivate && !isUnlocked) {
      setPinModalOpen(true);
      toast.info('Enter your 4-digit PIN to view private entries');
      return;
    }
    setEditingId(entry.id);
    setTitle(entry.title);
    setBody(entry.body);
    setType(entry.type);
    setScriptureRef(entry.scriptureRef || '');
    setIsPrivate(Boolean(entry.isPrivate));
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Both a title and entry text are required');
      return;
    }
    if (editingId) {
      setEntries(
        updateJournalEntry(editingId, {
          title,
          body,
          type,
          scriptureRef: scriptureRef.trim() || undefined,
          isPrivate,
        })
      );
      toast.success('Entry updated');
    } else {
      const entry = addJournalEntry({
        title,
        body,
        type,
        scriptureRef: scriptureRef.trim() || undefined,
        isPrivate,
      });
      setEntries((prev) => [entry, ...prev]);
      toast.success('Entry saved');
    }
    setEditorOpen(false);
  };

  const handleDelete = (id: string) => {
    setEntries(removeJournalEntry(id));
    toast.success('Entry deleted');
  };

  const handleSavePrayer = () => {
    if (!prayerTitle.trim()) {
      toast.error('Please enter a prayer request title');
      return;
    }
    const created = addPersonalPrayer({
      title: prayerTitle,
      body: prayerBody,
      category: prayerCategory,
      scriptureRef: prayerScripture,
    });
    setPrayers((prev) => [created, ...prev]);
    setPrayerTitle('');
    setPrayerBody('');
    setPrayerScripture('');
    setPrayerDialogOpen(false);
    toast.success('Prayer request saved');
  };

  const handleTogglePrayerStatus = (id: string) => {
    const next = togglePersonalPrayerStatus(id);
    setPrayers(next);
    const item = next.find((p) => p.id === id);
    toast.success(item?.status === 'answered' ? 'Praise God! Marked as answered.' : 'Marked as ongoing.');
  };

  const handleDeletePrayer = (id: string) => {
    setPrayers(removePersonalPrayer(id));
    toast.success('Prayer request removed');
  };

  const handleExportBackup = () => {
    try {
      const json = exportAllUserData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `believers-library-backup-${localDateKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Personal journal & prayer backup exported');
    } catch {
      toast.error('Could not export backup');
    }
  };

  const handlePinAction = () => {
    const trimmed = pinInput.trim();
    if (!hasPinConfigured) {
      const res = setJournalPin(trimmed);
      if (!res.ok) {
        toast.error(res.error || 'Please enter a 4 to 8 digit PIN code');
        return;
      }
      setHasPinConfigured(true);
      setIsUnlocked(false);
      setPinInput('');
      setPinModalOpen(false);
      toast.success('Privacy PIN set (salted hash)! Private entries are now locked.');
      return;
    }

    const check = verifyJournalPin(trimmed);
    if (check.ok) {
      setIsUnlocked(true);
      setPinInput('');
      setPinModalOpen(false);
      toast.success('Private journal entries unlocked');
    } else {
      toast.error(check.error || 'Incorrect PIN code');
    }
  };

  const handleMood = (emoji: string) => {
    setMoods(setMoodLog(localDateKey(), emoji));
  };

  const todayMood = moods[localDateKey()];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-serif text-primary">Journal & Prayers</h1>
          <p className="text-xs text-muted-foreground">Personal reflections, scripture notes & prayer tracker</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            className={cn(
              'h-8 w-8 rounded-full',
              hasPinConfigured && !isUnlocked && 'border-amber-500 text-amber-600 bg-amber-50'
            )}
            onClick={() => {
              if (hasPinConfigured && isUnlocked) {
                setIsUnlocked(false);
                toast.info('Locked private journal entries');
              } else {
                setPinInput('');
                setPinModalOpen(true);
              }
            }}
            title={hasPinConfigured ? (isUnlocked ? 'Lock Private Entries' : 'Unlock Private Entries') : 'Set Privacy PIN'}
            aria-label="Privacy Lock"
          >
            {hasPinConfigured && !isUnlocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full"
            onClick={handleExportBackup}
            title="Export JSON Backup"
            aria-label="Export JSON Backup"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90 rounded-full" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Entry
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entries, scripture references, or prayers..."
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 rounded-xl grid grid-cols-2">
          <TabsTrigger value="entries" className="text-xs rounded-lg">
            Journal ({entries.length})
          </TabsTrigger>
          <TabsTrigger value="prayers" className="text-xs rounded-lg">
            My Prayer List ({prayers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="pt-4 space-y-5">
          {/* Categories (real counts, tap to filter) */}
          <div className="grid grid-cols-2 gap-3">
            {JOURNAL_TYPES.map((cat) => {
              const meta = TYPE_META[cat];
              const active = typeFilter === cat;
              return (
                <Card
                  key={cat}
                  onClick={() => setTypeFilter(active ? null : cat)}
                  className={cn(
                    'border-none shadow-sm bg-secondary/20 hover:bg-secondary/30 transition-colors cursor-pointer',
                    active && 'ring-2 ring-primary/60 bg-secondary/40'
                  )}
                >
                  <CardContent className="p-3.5 space-y-1.5">
                    <meta.icon className={cn('w-5 h-5', meta.color)} />
                    <div>
                      <h4 className="font-bold text-sm text-primary">{cat}</h4>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">
                        {counts[cat]} {counts[cat] === 1 ? 'Entry' : 'Entries'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {typeFilter && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Filtered to <strong>{typeFilter}</strong>
              </span>
              <Button variant="link" className="text-xs p-0 h-auto" onClick={() => setTypeFilter(null)}>
                Clear
              </Button>
            </div>
          )}

          {/* Entries */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-primary uppercase">
              {query || typeFilter ? 'Matching Entries' : 'Recent Entries'} ({visibleEntries.length})
            </h2>

            {visibleEntries.length === 0 ? (
              <Card className="border-none shadow-sm bg-secondary/20">
                <CardContent className="p-8 text-center space-y-3">
                  <PenLine className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {entries.length === 0
                      ? 'Write your first entry — prayers, gratitude, or scripture reflections.'
                      : 'No entries match your search.'}
                  </p>
                  {entries.length === 0 && (
                    <Button size="sm" onClick={openNew}>
                      <Plus className="w-4 h-4 mr-2" /> Start Your Journal
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {visibleEntries.map((entry) => {
                  const lockedPrivate = Boolean(entry.isPrivate && !isUnlocked);
                  return (
                    <Card key={entry.id} className="border-none shadow-sm overflow-hidden group">
                      <CardContent className="p-4 flex items-start gap-2">
                        <div className="flex-1 space-y-1.5 cursor-pointer min-w-0" onClick={() => openEdit(entry)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-primary text-sm truncate flex items-center gap-1.5">
                              {entry.isPrivate && <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                              {lockedPrivate ? 'Private Reflection (Locked)' : entry.title}
                            </h4>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                              {entry.type}
                            </span>
                            {!lockedPrivate && entry.scriptureRef && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 gap-1 border-primary/30 text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/bible');
                                }}
                              >
                                <BookOpen className="w-2.5 h-2.5" /> {entry.scriptureRef}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {lockedPrivate ? 'Tap to enter your 4-digit PIN and view this private entry.' : entry.body}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase block">
                            {formatDate(entry.createdAt)}
                            {entry.updatedAt !== entry.createdAt && ' • edited'}
                          </span>
                        </div>
                        {!lockedPrivate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 shrink-0"
                            onClick={() => handleDelete(entry.id)}
                            aria-label={`Delete ${entry.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Personal Prayer Requests Tab */}
        <TabsContent value="prayers" className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {(['all', 'ongoing', 'answered'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setPrayerStatusFilter(st)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all',
                    prayerStatusFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
            <Button size="sm" className="h-8 rounded-full gap-1" onClick={() => setPrayerDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Prayer
            </Button>
          </div>

          {visiblePrayers.length === 0 ? (
            <Card className="border-none shadow-sm bg-secondary/20">
              <CardContent className="p-8 text-center space-y-3">
                <Heart className="w-8 h-8 mx-auto text-rose-500/70" />
                <p className="text-sm text-muted-foreground">
                  {prayers.length === 0
                    ? 'Keep a personal prayer list and rejoice as God answers your prayers over time.'
                    : 'No prayer requests match this filter.'}
                </p>
                {prayers.length === 0 && (
                  <Button size="sm" onClick={() => setPrayerDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add First Prayer Request
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visiblePrayers.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    'border-none shadow-sm border-l-4',
                    p.status === 'answered' ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-primary'
                  )}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-primary">{p.title}</h4>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {p.category}
                          </Badge>
                          {p.scriptureRef && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                              <BookOpen className="w-2.5 h-2.5" /> {p.scriptureRef}
                            </Badge>
                          )}
                        </div>
                        {p.body && <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>}
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">
                          Added {formatDate(p.createdAt)}
                          {p.status === 'answered' && p.answeredAt && ` • Answered ${formatDate(p.answeredAt)}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => handleDeletePrayer(p.id)}
                        aria-label={`Delete ${p.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant={p.status === 'answered' ? 'secondary' : 'outline'}
                        className={cn(
                          'h-7 text-xs gap-1.5',
                          p.status === 'answered' && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        )}
                        onClick={() => handleTogglePrayerStatus(p.id)}
                      >
                        {p.status === 'answered' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Answered
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" /> Mark Answered
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mood Tracker */}
      <div className="p-6 rounded-2xl bg-primary text-primary-foreground space-y-4 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
        <PenLine className="w-8 h-8 opacity-80" />
        <div>
          <h3 className="text-xl font-serif font-bold">Mood Tracker</h3>
          <p className="text-xs opacity-80 font-medium">How are you feeling spiritually today?</p>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {MOODS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleMood(emoji)}
              className={cn(
                'w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-xl transition-transform active:scale-90',
                todayMood === emoji && 'ring-2 ring-white bg-white/40'
              )}
              aria-label={`Mood ${emoji}`}
              aria-pressed={todayMood === emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        {todayMood && <p className="text-[10px] opacity-70 uppercase font-bold">Logged for today</p>}
      </div>

      {/* Journal Entry Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'New Journal Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Morning Gratitude)"
            />
            <div className="flex flex-wrap gap-2">
              {JOURNAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                    type === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Input
              value={scriptureRef}
              onChange={(e) => setScriptureRef(e.target.value)}
              placeholder="Linked Scripture (optional, e.g. Psalm 23:1)"
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write what's on your heart..."
              className="min-h-[150px]"
            />
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                'w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all',
                isPrivate ? 'border-amber-500/50 bg-amber-500/10 text-amber-800' : 'border-border/50 text-muted-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Mark as Private Reflection (PIN-protected)
              </span>
              <Badge variant={isPrivate ? 'default' : 'outline'} className="text-[10px]">
                {isPrivate ? 'Private' : 'Standard'}
              </Badge>
            </button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                {editingId ? 'Save Changes' : 'Save Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Personal Prayer Request Dialog */}
      <Dialog open={prayerDialogOpen} onOpenChange={setPrayerDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Personal Prayer Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={prayerTitle}
              onChange={(e) => setPrayerTitle(e.target.value)}
              placeholder="What are you praying for?"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRAYER_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPrayerCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                    prayerCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <Input
              value={prayerScripture}
              onChange={(e) => setPrayerScripture(e.target.value)}
              placeholder="Scripture promise (optional, e.g. Philippians 4:6)"
            />
            <Textarea
              value={prayerBody}
              onChange={(e) => setPrayerBody(e.target.value)}
              placeholder="Details, names, or specific petitions..."
              className="min-h-[110px]"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPrayerDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSavePrayer}>
                Save Prayer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy PIN Lock Dialog */}
      <Dialog open={pinModalOpen} onOpenChange={setPinModalOpen}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              {hasPinConfigured ? 'Unlock Private Entries' : 'Set 4-Digit Privacy PIN'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              {hasPinConfigured
                ? 'Enter your 4-digit PIN to view entries marked as Private.'
                : 'Create a 4 to 8 digit PIN to lock entries marked as Private on this device (stored as a salted hash).'}
            </p>
            <Input
              type="password"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className="text-center tracking-widest text-lg font-bold"
            />
            <div className="flex gap-2">
              {hasPinConfigured && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive"
                  onClick={() => {
                    clearJournalPin();
                    setHasPinConfigured(false);
                    setIsUnlocked(true);
                    setPinModalOpen(false);
                    toast.info('Privacy PIN removed');
                  }}
                >
                  Clear PIN
                </Button>
              )}
              <Button className="flex-1" onClick={handlePinAction}>
                {hasPinConfigured ? 'Unlock' : 'Save PIN'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
