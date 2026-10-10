import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Send, 
  Sparkles, 
  ChevronLeft, 
  Book, 
  Heart, 
  Mic,
  MessageSquare,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
};

export function FaithGuide() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Peace be with you! I'm FaithGuide AI, your spiritual companion. How can I help you grow today? I can explain verses, suggest prayers, or recommend hymns.",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Mock AI Response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: getMockResponse(input),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  const getMockResponse = (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('prayer')) return "Here's a prayer for your day: 'Lord, guide my steps and fill my heart with Your peace. May my actions today reflect Your love and grace. Amen.'";
    if (q.includes('verse') || q.includes('bible')) return "Philippians 4:13 says: 'I can do all things through Christ who strengthens me.' This is a powerful reminder that His strength is perfected in our weakness.";
    if (q.includes('hymn')) return "I recommend 'It Is Well With My Soul'. It's a beautiful expression of trust in God during difficult times.";
    return "That's a thoughtful question. In the light of scripture, we are encouraged to seek wisdom and understanding through prayer and meditation on God's word. Would you like me to find some relevant verses for you?";
  };

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col max-w-md mx-auto">
      <header className="px-6 py-4 flex items-center gap-4 bg-primary text-primary-foreground shadow-lg">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => window.history.back()}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shadow-inner">
            <Sparkles className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold">FaithGuide AI</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Online & Ready</span>
            </div>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat opacity-95"
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex w-full",
                msg.sender === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl p-4 shadow-sm",
                msg.sender === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-white border border-border/50 text-foreground rounded-tl-none"
              )}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <span className="text-[8px] font-bold uppercase opacity-50 block mt-2">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-6 bg-card border-t border-border/50 space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {['Pray for me', 'Daily Verse', 'Recommend Hymn', 'Explain Grace'].map((hint) => (
            <Button 
              key={hint} 
              variant="outline" 
              size="sm" 
              onClick={() => { setInput(hint); handleSend(); }}
              className="whitespace-nowrap rounded-full border-primary/20 text-primary hover:bg-primary/5 text-xs font-bold"
            >
              {hint}
            </Button>
          ))}
        </div>
        <div className="flex gap-3">
          <Input
            placeholder="Ask FaithGuide anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 h-12 bg-muted/50 border-none rounded-xl"
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-12 h-12 rounded-xl shadow-lg bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
