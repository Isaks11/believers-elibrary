import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Flame,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Trophy,
  Music2,
  Library,
  ScrollText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';
import { computeStreak, activeDaysThisWeek, countCompletedDevotionals } from '@/lib/activity';
import { getDevotionals } from '@/data/mockDevotionalHymnData';
import { loadDailyVerse } from '@/lib/contentSource';
import { MONTHS, type DevotionalEntry } from '@/types/devotional-hymn';
import { toast } from 'sonner';

const DAILY_VERSE = {
  text: '"For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future."',
  reference: 'Jeremiah 29:11',
};

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cmsVerse, setCmsVerse] = useState<{ text: string; ref: string } | null>(null);

  // Scripture of the day from the church CMS (memoized for 5 minutes in
  // contentSource). While it loads — and if there is none — the built-in
  // DAILY_VERSE below is shown, so the card is never empty.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const verse = await loadDailyVerse();
      if (!cancelled) setCmsVerse(verse);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dailyVerse = cmsVerse
    ? { text: cmsVerse.text, reference: cmsVerse.ref }
    : { text: DAILY_VERSE.text, reference: DAILY_VERSE.reference };

  const streak = useMemo(() => computeStreak(), []);
  const week = useMemo(() => activeDaysThisWeek(), []);
  const completedCount = useMemo(() => countCompletedDevotionals(), []);

  const [todayDevotional, setTodayDevotional] = useState<DevotionalEntry | null>(() => {
    const now = new Date();
    try {
      return (
        getDevotionals().find(
          (d) => d.year === now.getFullYear() && d.month === MONTHS[now.getMonth()] && d.day === now.getDate()
        ) ?? null
      );
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const checkToday = () => {
      const now = new Date();
      const dev = getDevotionals().find(
        (d) => d.year === now.getFullYear() && d.month === MONTHS[now.getMonth()] && d.day === now.getDate()
      ) ?? null;
      setTodayDevotional(dev);
    };
    checkToday();
    window.addEventListener('cms:content-changed', checkToday);
    window.addEventListener('storage', checkToday);
    return () => {
      window.removeEventListener('cms:content-changed', checkToday);
      window.removeEventListener('storage', checkToday);
    };
  }, []);

  const sections = [
    { title: 'Daily Devotional', icon: BookOpen, color: 'text-rose-600', to: '/devotional' },
    { title: 'Hymn Book', icon: Music2, color: 'text-emerald-600', to: '/hymns' },
    { title: 'Bible Reader', icon: ScrollText, color: 'text-blue-600', to: '/bible' },
    { title: 'E-Library', icon: Library, color: 'text-purple-600', to: '/library' },
  ];

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const shareVerse = async () => {
    const shareText = `"${dailyVerse.text}" — ${dailyVerse.reference}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Daily Verse', text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      toast.success('Verse copied to clipboard');
    } catch {
      toast.error('Could not share the verse');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <AppIcon className="h-12 w-12 shadow-md shadow-primary/10" />
          <div>
            <h1 className="text-2xl font-serif text-primary">
              {greetingForHour(now.getHours())}, {user?.name}
            </h1>
            <p className="text-muted-foreground text-sm">Today is {dateLabel}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-full border border-accent/30"
          title={streak > 0 ? `${streak}-day activity streak` : 'No streak yet — act today to start'}
        >
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-sm font-bold text-primary">{streak}</span>
        </div>
      </header>

      {/* Daily Verse */}
      <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/bible-module-bg-2d68d807-1782601933195.webp')] bg-cover opacity-20 group-hover:scale-110 transition-transform duration-700" />
        <CardContent className="p-6 relative z-10 space-y-4">
          <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none">Daily Verse</Badge>
          <blockquote className="text-xl font-serif italic leading-relaxed">
            {dailyVerse.text}
          </blockquote>
          <cite className="block text-sm opacity-80">— {dailyVerse.reference}</cite>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="secondary" className="bg-white text-primary hover:bg-white/90" onClick={shareVerse}>
              Share
            </Button>
            <Button size="sm" variant="outline" className="text-white border-white/40 hover:bg-white/10" onClick={() => navigate('/journal')}>
              Reflect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Devotional */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-serif text-primary">Today's Devotional</h2>
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate('/devotional')}>
            View All <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
        <Card
          className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
          onClick={() => navigate('/devotional')}
        >
          <div className="h-48 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp')] bg-cover bg-center" />
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <span>{dateLabel}</span>
              {todayDevotional ? (
                <span>{todayDevotional.scriptureRef}</span>
              ) : (
                <span>Read • Reflect • Pray</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-primary group-hover:text-primary/80">
              {todayDevotional ? todayDevotional.title : 'Daily Devotional'}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {todayDevotional
                ? todayDevotional.keyThought
                : 'No devotional scheduled for today. Explore reading plans or check back as church admins publish new devotionals.'}
            </p>
            <div className="pt-2 flex items-center justify-between">
              {todayDevotional && todayDevotional.isCompleted ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-none">Completed</Badge>
              ) : (
                <span />
              )}
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => { e.stopPropagation(); navigate('/devotional'); }}
              >
                {todayDevotional ? (todayDevotional.isCompleted ? 'Review' : 'Continue Reading') : 'Explore Devotionals'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats (derived from real activity) */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-secondary border-none">
          <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
            <TrendingUp className="w-6 h-6 text-primary" />
            <span className="text-2xl font-bold text-primary">
              {Math.round((week.active / week.total) * 100)}%
            </span>
            <span className="text-xs text-muted-foreground font-medium uppercase">
              Weekly Activity ({week.active}/{week.total} days)
            </span>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-none">
          <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
            <Trophy className="w-6 h-6 text-accent" />
            <span className="text-2xl font-bold text-primary">{completedCount}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase">Devotionals Completed</span>
          </CardContent>
        </Card>
      </div>

      {/* Grid Sections */}
      <div className="grid grid-cols-2 gap-4 pb-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
          <Button
            key={section.title}
            variant="outline"
            onClick={() => navigate(section.to)}
            className="h-auto py-6 flex flex-col items-center gap-3 border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className={cn("p-3 rounded-2xl bg-white shadow-sm transition-transform group-hover:scale-110", section.color)}>
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-primary">{section.title}</span>
          </Button>
          );
        })}
      </div>
    </div>
  );
}
