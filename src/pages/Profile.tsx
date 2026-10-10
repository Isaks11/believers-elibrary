import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  History, 
  Bookmark, 
  Download, 
  Trophy, 
  Calendar, 
  LogOut,
  ChevronRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Profile() {
  const { user, logout } = useAuth();

  const stats = [
    { label: 'Reading Streak', value: '12 Days', icon: Calendar, color: 'text-orange-500' },
    { label: 'Achievements', value: '24', icon: Trophy, color: 'text-yellow-600' },
    { label: 'Completed', value: '163', icon: ShieldCheck, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-8 pb-20">
      <header className="flex justify-between items-start">
        <h1 className="text-2xl font-serif text-primary">My Profile</h1>
        <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
      </header>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative">
          <Avatar className="w-24 h-24 ring-4 ring-primary/10 shadow-xl">
            <AvatarImage src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.id}`} />
            <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
          </Avatar>
          {!user?.isGuest && (
            <div className="absolute -bottom-1 -right-1 bg-accent text-accent-foreground p-1.5 rounded-full shadow-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-primary">{user?.name}</h2>
          <p className="text-sm text-muted-foreground font-medium">{user?.isGuest ? 'Guest Member' : 'Premium Member'}</p>
        </div>
        {user?.isGuest && (
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8">
            Upgrade to Registered
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none bg-secondary/30 shadow-sm text-center">
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <stat.icon className={cn("w-5 h-5", stat.color)} />
              <span className="text-lg font-bold text-primary">{stat.value}</span>
              <span className="text-[8px] uppercase font-bold text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Activity & Storage</h3>
        {[
          { icon: History, label: 'Reading History', count: '163 entries' },
          { icon: Bookmark, label: 'Bookmarks', count: '42 items' },
          { icon: Download, label: 'Offline Downloads', count: '1.2 GB' },
          { icon: CreditCard, label: 'Subscription', count: 'Premium Plan' },
        ].map((item) => (
          <Button 
            key={item.label}
            variant="outline" 
            className="w-full justify-between h-14 border-border/40 bg-card hover:bg-primary/5 hover:border-primary/20 transition-all px-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/5">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold block">{item.label}</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase">{item.count}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Button>
        ))}
      </div>

      <Button 
        variant="ghost" 
        onClick={logout}
        className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold"
      >
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}
