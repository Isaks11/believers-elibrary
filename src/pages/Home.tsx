import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Flame, 
  Calendar, 
  BookOpen, 
  Music, 
  Mic, 
  Video, 
  Heart, 
  ChevronRight,
  TrendingUp,
  Trophy,
  Music2,
  Library,
  ScrollText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';

export function Home() {
  const { user } = useAuth();

  const sections = [
    { title: 'Daily Devotional', icon: BookOpen, color: 'text-rose-600', to: '/devotional' },
    { title: 'Hymn Book', icon: Music2, color: 'text-emerald-600', to: '/hymns' },
    { title: 'Bible Reader', icon: ScrollText, color: 'text-blue-600', to: '/bible' },
    { title: 'E-Library', icon: Library, color: 'text-purple-600', to: '/library' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <AppIcon className="h-12 w-12 shadow-md shadow-primary/10" />
          <div>
            <h1 className="text-2xl font-serif text-primary">Good Morning, {user?.name}</h1>
            <p className="text-muted-foreground text-sm">Today is Monday, June 12</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-full border border-accent/30">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-sm font-bold text-primary">12</span>
        </div>
      </header>

      {/* Daily Verse */}
      <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/bible-module-bg-2d68d807-1782601933195.webp')] bg-cover opacity-20 group-hover:scale-110 transition-transform duration-700" />
        <CardContent className="p-6 relative z-10 space-y-4">
          <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none">Daily Verse</Badge>
          <blockquote className="text-xl font-serif italic leading-relaxed">
            "For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future."
          </blockquote>
          <cite className="block text-sm opacity-80">— Jeremiah 29:11</cite>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="secondary" className="bg-white text-primary hover:bg-white/90">Share</Button>
            <Button size="sm" variant="outline" className="text-white border-white/40 hover:bg-white/10">Reflect</Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Devotional */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-serif text-primary">Today's Devotional</h2>
          <Button variant="ghost" size="sm" className="text-primary">View All <ChevronRight className="ml-1 w-4 h-4" /></Button>
        </div>
        <Card className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
          <div className="h-48 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp')] bg-cover bg-center" />
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <span>June 12 • Day 163</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3 fill-rose-500 text-rose-500" /> 1.2k</span>
            </div>
            <h3 className="text-lg font-bold text-primary group-hover:text-primary/80">Walking in Divine Purpose</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">Understanding how God leads us through seasons of uncertainty and quietness...</p>
            <div className="pt-2 flex items-center justify-between">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-muted flex items-center justify-center text-[10px] font-bold">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
                <span className="ml-4 text-xs text-muted-foreground font-medium self-center">+12k Reading</span>
              </div>
              <Button size="sm" className="bg-primary hover:bg-primary/90">Continue Reading</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-secondary border-none">
          <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
            <TrendingUp className="w-6 h-6 text-primary" />
            <span className="text-2xl font-bold text-primary">85%</span>
            <span className="text-xs text-muted-foreground font-medium uppercase">Weekly Progress</span>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-none">
          <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
            <Trophy className="w-6 h-6 text-accent" />
            <span className="text-2xl font-bold text-primary">Master</span>
            <span className="text-xs text-muted-foreground font-medium uppercase">Current Level</span>
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
            onClick={() => { window.location.href = `#${section.to}` }}
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