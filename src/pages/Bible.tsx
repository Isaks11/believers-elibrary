import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Settings, 
  Book, 
  Bookmark, 
  History, 
  Volume2, 
  Moon, 
  Sun,
  ChevronDown,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

const VERSIONS = ['KJV', 'NKJV', 'NIV', 'ESV', 'AMP', 'NLT'];
const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel'];

export function Bible() {
  const [version, setVersion] = useState('NIV');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  return (
    <div className={cn("space-y-6 pb-20 -mx-4 px-4 min-h-screen", isDarkMode ? "bg-slate-950 text-slate-100" : "bg-background text-foreground")}>
      <header className="sticky top-0 z-40 bg-inherit py-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-card border-border/50 font-bold">
              {version} <ChevronDown className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="bg-card border-border/50 font-bold">
              Genesis 1 <ChevronDown className="ml-1 w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search Bible..." 
            className="pl-10 bg-card/50 border-none shadow-inner"
          />
        </div>
      </header>

      {/* Bible Content */}
      <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-3xl font-serif text-center py-4 border-b border-border/20">Genesis 1</h2>
        
        <div className="space-y-6 leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
          {[
            "In the beginning God created the heavens and the earth.",
            "Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters.",
            "And God said, \"Let there be light,\" and there was light.",
            "God saw that the light was good, and he separated the light from the darkness.",
            "God called the light \"day,\" and the darkness he called \"night.\" And there was evening, and there was morning—the first day."
          ].map((verse, i) => (
            <div key={i} className="flex gap-4 group">
              <span className="text-xs font-bold text-muted-foreground pt-1.5 min-w-[20px]">{i + 1}</span>
              <p className={cn(
                "flex-1 transition-colors cursor-pointer rounded-lg px-2 -mx-2 hover:bg-primary/5",
                i === 0 && "font-bold text-primary"
              )}>
                {verse}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bible Footer Actions */}
      <div className={cn(
        "fixed bottom-20 left-4 right-4 p-2 rounded-2xl flex justify-around items-center backdrop-blur-xl border border-white/20 shadow-2xl z-40 transition-colors",
        isDarkMode ? "bg-slate-900/80 text-white" : "bg-white/80 text-primary"
      )}>
        <Button variant="ghost" className="flex-col gap-1 h-auto py-2">
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Bookmark</span>
        </Button>
        <Button variant="ghost" className="flex-col gap-1 h-auto py-2 text-accent">
          <Volume2 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Listen</span>
        </Button>
        <Button variant="ghost" className="flex-col gap-1 h-auto py-2">
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Parallel</span>
        </Button>
        <Button variant="ghost" className="flex-col gap-1 h-auto py-2">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">History</span>
        </Button>
      </div>
    </div>
  );
}
