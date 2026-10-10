import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  PenLine, 
  Plus, 
  Calendar, 
  Smile, 
  Heart, 
  Moon, 
  Sun,
  FileText,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Journal() {
  const [entries, setEntries] = useState([
    { id: 1, title: 'Morning Gratitude', date: 'June 12', preview: 'Today I am thankful for the breath in my lungs and the sunshine...', type: 'Gratitude' },
    { id: 2, title: 'Prayer for Peace', date: 'June 11', preview: 'Lord, I lift up my concerns regarding work and my relationship...', type: 'Prayer' },
  ]);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-serif text-primary">My Journals</h1>
        <Button size="sm" className="bg-primary hover:bg-primary/90 rounded-full">
          <Plus className="w-4 h-4 mr-2" /> New Entry
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Prayer Journal', icon: Heart, color: 'text-rose-500', count: 12 },
          { label: 'Gratitude', icon: Smile, color: 'text-amber-500', count: 45 },
          { label: 'Dream Journal', icon: Moon, color: 'text-indigo-500', count: 8 },
          { label: 'Notes', icon: FileText, color: 'text-slate-500', count: 120 },
        ].map((cat) => (
          <Card key={cat.label} className="border-none shadow-sm bg-secondary/20 hover:bg-secondary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 space-y-2">
              <cat.icon className={cn("w-6 h-6", cat.color)} />
              <div>
                <h4 className="font-bold text-sm text-primary">{cat.label}</h4>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">{cat.count} Entries</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Recent Entries</h2>
          <Button variant="link" className="text-accent text-xs uppercase font-bold">Calendar View</Button>
        </div>

        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-none shadow-sm overflow-hidden group">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-primary text-sm">{entry.title}</h4>
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{entry.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{entry.preview}</p>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">{entry.date}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-primary text-primary-foreground space-y-4 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
        <PenLine className="w-8 h-8 opacity-80" />
        <div>
          <h3 className="text-xl font-serif font-bold">Mood Tracker</h3>
          <p className="text-xs opacity-80 font-medium">How are you feeling spiritually today?</p>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {['🙏', '😊', '😔', '🕊️', '🔥'].map((emoji) => (
            <button key={emoji} className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-xl transition-transform active:scale-90">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
