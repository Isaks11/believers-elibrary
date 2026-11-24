import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Trophy,
  Music2,
  Library,
  ScrollText,
  HeartHandshake,
  MessageSquare,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/common/AppIcon";
import { DonateDialog } from "@/components/common/DonateDialog";
import { ContactDialog } from "@/components/common/ContactDialog";
import { getDailyVerseForDate } from "@/data/dailyVerseLibrary";
import {
  computeStreak,
  activeDaysThisWeek,
  countCompletedDevotionals,
} from "@/lib/activity";
import { getDevotionals } from "@/data/mockDevotionalHymnData";
import {
  cmsDevotionalToPageDevotional,
  loadAllPublishedDevotionals,
  loadDailyVerse,
} from "@/lib/contentSource";
import { MONTHS, type DevotionalEntry } from "@/types/devotional-hymn";
import { toast } from "sonner";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80", // sky
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80", // nature/landscape
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80", // ocean
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80", // forest
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1400&q=80", // flowers
  "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1400&q=80", // wildlife
];

const TODAY_FALLBACK_VERSE = getDailyVerseForDate();
const DAILY_VERSE = {
  text: TODAY_FALLBACK_VERSE.text,
  reference: TODAY_FALLBACK_VERSE.ref,
};

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cmsVerse, setCmsVerse] = useState<{
    text: string;
    ref: string;
  } | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroImageIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, []);

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

  const [todayDevotional, setTodayDevotional] =
    useState<DevotionalEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolveToday = (items: DevotionalEntry[]) => {
      const now = new Date();
      return (
        items.find(
          (d) =>
            d.year === now.getFullYear() &&
            d.month === MONTHS[now.getMonth()] &&
            d.day === now.getDate(),
        ) ?? null
      );
    };
    const refresh = async () => {
      const local = getDevotionals();
      try {
        const published = await loadAllPublishedDevotionals();
        if (cancelled) return;
        const byId = new Map(local.map((d) => [d.id, d]));
        published.map(cmsDevotionalToPageDevotional).forEach((d) => {
          if (!byId.has(d.id)) byId.set(d.id, d);
        });
        setTodayDevotional(resolveToday(Array.from(byId.values())));
      } catch {
        if (!cancelled) setTodayDevotional(resolveToday(local));
      }
    };
    void refresh();
    const onChange = () => {
      void refresh();
    };
    window.addEventListener("cms:content-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("cms:content-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const sections = [
    {
      title: "Daily Devotional",
      icon: BookOpen,
      color: "text-rose-600",
      to: "/devotional",
    },
    {
      title: "Hymn Book",
      icon: Music2,
      color: "text-emerald-600",
      to: "/hymns",
    },
    {
      title: "Bible Reader",
      icon: ScrollText,
      color: "text-blue-600",
      to: "/bible",
    },
    {
      title: "E-Library",
      icon: Library,
      color: "text-purple-600",
      to: "/library",
    },
  ];

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const shareVerse = async () => {
    const shareText = `"${dailyVerse.text}" — ${dailyVerse.reference}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Daily Verse", text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      toast.success("Verse copied to clipboard");
    } catch {
      toast.error("Could not share the verse");
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
            <p className="text-muted-foreground text-sm">
              Today is {dateLabel}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-full border border-accent/30"
          title={
            streak > 0
              ? `${streak}-day activity streak`
              : "No streak yet — act today to start"
          }
        >
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-sm font-bold text-primary">{streak}</span>
        </div>
      </header>

      {/* Daily Verse */}
      <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative group">
        <AnimatePresence mode="wait">
          <motion.div
            key={heroImageIndex}
            initial={{ opacity: 0.15, scale: 1.04 }}
            animate={{ opacity: 0.28, scale: 1 }}
            exit={{ opacity: 0.1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${HERO_IMAGES[heroImageIndex]}')` }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-br from-black/35 via-primary/40 to-black/25" />
        <CardContent className="p-6 relative z-10 space-y-4">
          <Badge
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm"
          >
            Daily Verse
          </Badge>
          <blockquote className="text-xl font-serif italic leading-relaxed drop-shadow-sm">
            {dailyVerse.text}
          </blockquote>
          <cite className="block text-sm text-white/90 font-medium">
            - {dailyVerse.reference}
          </cite>
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 shadow-sm"
              onClick={shareVerse}
            >
              Share
            </Button>
            <Button
              size="sm"
              className="bg-black/35 border border-white/70 text-white hover:bg-black/45 hover:text-white backdrop-blur-sm shadow-sm"
              onClick={() => navigate("/journal?kind=reflection")}
            >
              Reflect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Devotional */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-serif text-primary">
            Today's Devotional
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => navigate("/devotional")}
          >
            View All <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
        <Card
          className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
          onClick={() => navigate("/devotional")}
        >
          <div className="relative h-48 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`dev-card-${heroImageIndex}`}
                initial={{ opacity: 0.5, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.4 }}
                transition={{ duration: 1.1 }}
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('${HERO_IMAGES[(heroImageIndex + 2) % HERO_IMAGES.length]}')`,
                }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          </div>
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
              {todayDevotional ? todayDevotional.title : "Daily Devotional"}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {todayDevotional
                ? todayDevotional.keyThought
                : "No devotional scheduled for today. Explore reading plans or check back as church admins publish new devotionals."}
            </p>
            <div className="pt-2 flex items-center justify-between">
              {todayDevotional && todayDevotional.isCompleted ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-none">
                  Completed
                </Badge>
              ) : (
                <span />
              )}
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/devotional");
                }}
              >
                {todayDevotional
                  ? todayDevotional.isCompleted
                    ? "Review"
                    : "Continue Reading"
                  : "Explore Devotionals"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats (derived from real activity) */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/10 border-none">
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
            <span className="text-2xl font-bold text-primary">
              {completedCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium uppercase">
              Devotionals Completed
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Support & Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
        {/* Support Card */}
        <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm flex flex-col justify-between">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-primary">
                  Support the Ministry
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Give towards ministry outreach, discipleship resources, and app
                development.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setDonateOpen(true)}
              className="w-full sm:w-auto self-end"
            >
              Give
            </Button>
          </CardContent>
        </Card>

        {/* Contact Us Card */}
        <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm flex flex-col justify-between">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-primary">
                  Contact Us
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Have questions, feedback, or need assistance? Get in touch with
                our team.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setContactOpen(true)}
              className="w-full sm:w-auto self-end"
            >
              Contact Us
            </Button>
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
              <div
                className={cn(
                  "p-3 rounded-2xl bg-white shadow-sm transition-transform group-hover:scale-110",
                  section.color,
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-primary">
                {section.title}
              </span>
            </Button>
          );
        })}
      </div>

      <DonateDialog open={donateOpen} onOpenChange={setDonateOpen} />
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}
