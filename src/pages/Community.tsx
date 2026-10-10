import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MessageSquare, 
  Heart, 
  Share2, 
  Calendar, 
  PlusCircle,
  Search,
  Filter
} from 'lucide-react';

const GROUPS = [
  { id: 1, name: 'Morning Prayer Warriors', members: 1250, description: 'Interceding for the world every sunrise.' },
  { id: 2, name: 'Youth Bible Study', members: 840, description: 'Exploring faith and life together.' },
  { id: 3, name: 'Mothers of Faith', members: 2100, description: 'Supporting each other in the journey of motherhood.' },
];

export function Community() {
  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-serif text-primary">Community</h1>
        <Button size="sm" className="bg-primary hover:bg-primary/90 rounded-full">
          <PlusCircle className="w-4 h-4 mr-2" /> New Post
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search groups, friends, or topics..." className="pl-10 bg-card/50 border-none shadow-sm" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Featured Groups</h2>
          <Button variant="link" className="text-accent text-xs uppercase font-bold">See All</Button>
        </div>
        
        <div className="flex overflow-x-auto gap-4 no-scrollbar pb-2 -mx-4 px-4">
          {GROUPS.map((group) => (
            <Card key={group.id} className="min-w-[280px] border-none shadow-md bg-secondary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary">{group.name}</h4>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{group.members} Members</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                <Button variant="secondary" size="sm" className="w-full bg-white text-primary hover:bg-white/90">Join Group</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">Community Feed</h2>
        {[1, 2].map((post) => (
          <Card key={post} className="border-none shadow-sm overflow-hidden">
            <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
              <Avatar className="w-10 h-10 border border-primary/10">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${post}`} />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-primary text-sm">Sarah Jenkins</h4>
                  <Badge variant="secondary" className="text-[8px] h-4 uppercase">Prayer Warrior</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">2 hours ago in Morning Prayer</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-sm text-foreground/90 leading-relaxed">
                Thank You Lord for another beautiful morning! My heart is full of gratitude for the healing my family has experienced this week. God is indeed faithful! 🙏✨
              </p>
              <div className="flex items-center gap-6 py-2 border-y border-border/20">
                <button className="flex items-center gap-2 text-rose-500 font-bold text-[10px] uppercase">
                  <Heart className="w-4 h-4 fill-current" /> 42
                </button>
                <button className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase">
                  <MessageSquare className="w-4 h-4" /> 12
                </button>
                <button className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
