import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users,
  MessageSquare,
  Heart,
  Share2,
  PlusCircle,
  Search,
  Send,
  Check,
  ShieldAlert,
  Flag,
  Ban,
  Lock,
  Globe,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CommunityGroup,
  CommunityPost,
  PostCategory,
  PostPrivacyScope,
  ReportReason,
  ModerationReport,
  FELLOWSHIP_GROUPS,
  COMMUNITY_RULES,
  getCommunityPosts,
  saveCommunityPosts,
  getJoinedGroups,
  saveJoinedGroups,
  getBlockedAuthors,
  toggleBlockAuthor,
  getModerationReports,
  submitCommunityReport,
  resolveModerationReport,
  createCommunityOrPrayerPost,
  validateCommunityContent,
  checkAndRecordRateLimit,
  syncCommunityDataFromServer,
  pushCommunityComment,
} from '@/data/communityData';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or unkind speech' },
  { value: 'privacy_violation', label: 'Shares private personal/medical details' },
  { value: 'scam_solicitation', label: 'Financial solicitation or scam link' },
  { value: 'false_teaching_spam', label: 'Spam or disruptive content' },
  { value: 'other', label: 'Other safeguarding concern' },
];

export function Community() {
  const { user, isRemote } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<CommunityPost[]>(() => getCommunityPosts());
  const [joinedGroups, setJoinedGroups] = useState<number[]>(() => getJoinedGroups());
  const [blockedAuthors, setBlockedAuthors] = useState<string[]>(() => getBlockedAuthors());
  const [reports, setReports] = useState<ModerationReport[]>(() => getModerationReports());
  const [query, setQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [showAllGroups, setShowAllGroups] = useState(false);

  useEffect(() => {
    syncCommunityDataFromServer().then((synced) => {
      setPosts(synced.posts);
      setBlockedAuthors(synced.blockedAuthors);
      setJoinedGroups(synced.joinedGroups);
      if (synced.error) {
        toast.error(`Community sync failed — showing local data. ${synced.error}`);
      }
    });
  }, []);

  // Rules & Blocked Users Dialog
  const [rulesOpen, setRulesOpen] = useState(false);

  // New Post / Controlled Prayer Sharing Dialog
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [postBody, setPostBody] = useState('');
  const [postGroup, setPostGroup] = useState(FELLOWSHIP_GROUPS[0].name);
  const [postCategory, setPostCategory] = useState<PostCategory>('testimony');
  const [privacyScope, setPrivacyScope] = useState<PostPrivacyScope>('community_public');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [scriptureRef, setScriptureRef] = useState('');

  // Active comment box per post
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Report Modal state
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'post' | 'comment';
    targetId: string;
    postId: string;
    targetSnippet: string;
    targetAuthor: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportDetails, setReportDetails] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? FELLOWSHIP_GROUPS
      : FELLOWSHIP_GROUPS.filter(
          (g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)
        );
    return showAllGroups ? list : list.slice(0, 3);
  }, [query, showAllGroups]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (p.moderationStatus === 'removed') return false;
      if (blockedAuthors.includes(p.author) || blockedAuthors.includes(p.authorId)) return false;

      // Enforce group_only privacy scope: only visible if user joined that group or selected that group filter
      if (p.privacyScope === 'group_only') {
        const groupObj = FELLOWSHIP_GROUPS.find((g) => g.name === p.groupName);
        const isMember = groupObj ? joinedGroups.includes(groupObj.id) : false;
        const isOwner = p.authorId === (user?.email || 'local');
        if (!isMember && !isOwner && user?.role !== 'admin') return false;
      }

      if (selectedGroupFilter && p.groupName !== selectedGroupFilter) return false;

      if (!q) return true;
      return (
        p.body.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.groupName.toLowerCase().includes(q) ||
        (p.scriptureRef ?? '').toLowerCase().includes(q)
      );
    });
  }, [posts, query, blockedAuthors, joinedGroups, selectedGroupFilter, user]);

  const pendingReports = useMemo(() => reports.filter((r) => r.status === 'pending'), [reports]);

  const toggleJoinGroup = (group: CommunityGroup) => {
    const joined = joinedGroups.includes(group.id);
    const next = joined ? joinedGroups.filter((id) => id !== group.id) : [...joinedGroups, group.id];
    setJoinedGroups(next);
    saveJoinedGroups(next);
    toast.success(joined ? `Left ${group.name}` : `Joined ${group.name}!`);
  };

  const handleCreatePost = () => {
    const result = createCommunityOrPrayerPost({
      authorId: user?.email || 'local-user',
      authorName: user?.name || 'Believer',
      authorRole:
        user?.role === 'admin' || user?.role === 'super_admin' ? 'admin' : 'user',
      isAnonymous,
      groupName: postGroup,
      category: postCategory,
      privacyScope,
      scriptureRef,
      body: postBody,
    });

    if (!result.ok) {
      toast.error(result.error || 'Could not publish post');
      return;
    }

    setPostBody('');
    setScriptureRef('');
    setIsAnonymous(false);
    setNewPostOpen(false);

    if (result.routedToPrivateJournal) {
      toast.success('Saved privately to your Personal Prayer List (not shared publicly).');
      navigate('/journal');
      return;
    }

    setPosts(getCommunityPosts());
    toast.success(
      privacyScope === 'group_only'
        ? `Shared with members of ${postGroup}!`
        : 'Shared with the fellowship community!'
    );
  };

  const handleLike = (postId: string) => {
    const next = posts.map((p) => {
      if (p.id !== postId) return p;
      const liked = !p.likedByMe;
      return { ...p, likedByMe: liked, likes: liked ? p.likes + 1 : Math.max(0, p.likes - 1) };
    });
    setPosts(next);
    saveCommunityPosts(next);
  };

  const handlePrayForPost = (postId: string) => {
    const next = posts.map((p) => {
      if (p.id !== postId) return p;
      const prayed = !p.prayedByMe;
      return {
        ...p,
        prayedByMe: prayed,
        prayedCount: prayed ? (p.prayedCount || 0) + 1 : Math.max(0, (p.prayedCount || 0) - 1),
      };
    });
    setPosts(next);
    saveCommunityPosts(next);
    toast.success('Recorded your prayer support');
  };

  const handleAddComment = (postId: string) => {
    const validation = validateCommunityContent(commentText);
    if (!validation.valid) {
      toast.error(validation.reason || 'Invalid comment');
      return;
    }
    const rate = checkAndRecordRateLimit(user?.email || 'local-user');
    if (!rate.allowed) {
      toast.error(`Please wait ${rate.retryAfterSeconds}s before commenting again.`);
      return;
    }

    const newComment = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `c-${Date.now()}`,
      authorId: user?.email || 'local-user',
      author: user?.name || 'Believer',
      text: commentText.trim(),
      createdAt: 'Just now',
      moderationStatus: 'active' as const,
    };
    const next = posts.map((p) =>
      p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p
    );
    setPosts(next);
    saveCommunityPosts(next);
    pushCommunityComment({
      id: newComment.id,
      postId,
      authorId: newComment.authorId,
      authorName: newComment.author,
      body: newComment.text,
    });
    setCommentText('');
    toast.success('Comment posted');
  };

  const handleSubmitReport = () => {
    if (!reportTarget) return;
    submitCommunityReport({
      ...reportTarget,
      reporterEmail: user?.email || 'local-user',
      reason: reportReason,
      details: reportDetails,
    });
    setReports(getModerationReports());
    setPosts(getCommunityPosts());
    setReportTarget(null);
    setReportDetails('');
    toast.success('Report submitted to the moderation queue for review.');
  };

  const handleBlockUser = (authorName: string) => {
    const res = toggleBlockAuthor(authorName);
    setBlockedAuthors(res.list);
    toast.info(
      res.blocked
        ? `Blocked ${authorName} — their posts are now hidden from your feed.`
        : `Unblocked ${authorName}`
    );
  };

  const handleAdminModerate = async (
    reportId: string,
    decision: 'resolved_removed' | 'resolved_dismissed'
  ) => {
    const res = await resolveModerationReport(
      reportId,
      decision,
      user?.role === 'admin' || user?.role === 'super_admin' ? 'admin' : 'user'
    );
    if (!res.ok) {
      toast.error(res.error || 'Moderation action denied');
      return;
    }
    setReports(res.reports);
    setPosts(res.posts);
    toast.success(
      decision === 'resolved_removed'
        ? 'Flagged content removed from community.'
        : 'Report dismissed; content restored.'
    );
  };

  const handleShare = async (post: CommunityPost) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Post by ${post.author}`, text: post.body });
        return;
      }
      await navigator.clipboard.writeText(`"${post.body}" — ${post.author}`);
      toast.success('Post copied to clipboard');
    } catch {
      toast.info('Post link ready to share');
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <header className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-serif text-primary">Fellowship Community</h1>
          <p className="text-xs text-muted-foreground">Bible study groups, testimonies & shared prayer</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRulesOpen(true)}
            className="rounded-full text-xs gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Safeguarding
          </Button>
          <Button
            size="sm"
            onClick={() => setNewPostOpen(true)}
            className="bg-primary hover:bg-primary/90 rounded-full text-xs"
          >
            <PlusCircle className="w-4 h-4 mr-1" /> Share
          </Button>
        </div>
      </header>

      {/* Honest Backend / Prototype Disclosure Banner */}
      <div
        className={cn(
          'p-3 rounded-xl border text-xs flex items-start gap-2.5',
          isRemote
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
        )}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-bold">
            {isRemote ? 'Connected to Supabase Community & RLS Moderation' : 'Local Device Prototype Mode (No Backend Configured)'}
          </p>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {isRemote
              ? 'Posts, reports, and admin moderation actions are synchronized with server-enforced Row Level Security.'
              : 'Because no Supabase backend is configured in this environment, posts, blocks, and moderation reports are saved only in this browser and do not provide live multi-user communication.'}
          </p>
        </div>
      </div>

      {/* Admin Moderation Queue Alert if user is Admin and reports are pending */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && pendingReports.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Admin Moderation Queue ({pendingReports.length} Pending)
              </h3>
              <Badge variant="outline" className="text-[10px]">
                Admin Only
              </Badge>
            </div>
            <div className="space-y-2">
              {pendingReports.map((rep) => (
                <div key={rep.id} className="p-2.5 rounded-lg bg-card border border-border/50 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-bold text-primary">
                      {rep.targetType.toUpperCase()} by {rep.targetAuthor}
                    </span>
                    <Badge variant="secondary" className="text-[9px]">
                      {rep.reason.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground italic">“{rep.targetSnippet}”</p>
                  {rep.details && <p className="text-[11px] text-foreground">Note: {rep.details}</p>}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleAdminModerate(rep.id, 'resolved_dismissed')}
                    >
                      Dismiss Report
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-[10px]"
                      onClick={() => handleAdminModerate(rep.id, 'resolved_removed')}
                    >
                      Remove Content
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups, testimonies, or Scripture references..."
          className="pl-10 bg-card/50 border-none shadow-sm"
        />
      </div>

      {/* Fellowship Groups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Fellowship Groups</h2>
          <div className="flex items-center gap-2">
            {selectedGroupFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedGroupFilter(null)}
                className="h-6 text-[10px] text-muted-foreground"
              >
                Clear Filter ({selectedGroupFilter})
              </Button>
            )}
            <Button
              variant="link"
              onClick={() => setShowAllGroups(!showAllGroups)}
              className="text-accent text-xs uppercase font-bold p-0 h-auto"
            >
              {showAllGroups ? 'Show Less' : 'See All'}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            showAllGroups
              ? 'grid grid-cols-1 gap-3'
              : 'flex overflow-x-auto gap-4 no-scrollbar pb-2 -mx-4 px-4'
          )}
        >
          {filteredGroups.map((group) => {
            const isJoined = joinedGroups.includes(group.id);
            const isSelected = selectedGroupFilter === group.name;
            return (
              <Card
                key={group.id}
                className={cn(
                  'min-w-[260px] border-none shadow-md bg-secondary/20 transition-all',
                  isSelected && 'ring-2 ring-primary'
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setSelectedGroupFilter(isSelected ? null : group.name)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-primary text-sm truncate">{group.name}</h4>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">
                          {group.members + (isJoined ? 1 : 0)} Members
                        </span>
                        {group.verifiedMinistry && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> {group.verifiedMinistry}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
                  <Button
                    variant={isJoined ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => toggleJoinGroup(group)}
                    className={cn(
                      'w-full gap-1.5 text-xs',
                      !isJoined && 'bg-white text-primary hover:bg-white/90'
                    )}
                  >
                    {isJoined && <Check className="w-3.5 h-3.5" />}
                    {isJoined ? 'Joined Fellowship' : 'Join Group'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Community Feed */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
          Community Feed ({filteredPosts.length})
        </h2>

        {filteredPosts.length === 0 ? (
          <Card className="border-none shadow-sm bg-secondary/20">
            <CardContent className="p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                No posts match your current group filter or search query.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => {
            const commentsOpen = openCommentsPostId === post.id;
            const visibleComments = post.comments.filter(
              (c) =>
                c.moderationStatus !== 'removed' &&
                !blockedAuthors.includes(c.author) &&
                !blockedAuthors.includes(c.authorId)
            );

            return (
              <Card key={post.id} className="border-none shadow-sm overflow-hidden">
                <CardHeader className="p-4 flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10 border border-primary/10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {post.author
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-primary text-sm truncate">{post.author}</h4>
                        <Badge variant="secondary" className="text-[8px] h-4 uppercase">
                          {post.badge}
                        </Badge>
                        {post.privacyScope === 'group_only' && (
                          <Badge variant="outline" className="text-[8px] h-4 gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> Group Only
                          </Badge>
                        )}
                        {post.moderationStatus === 'flagged' && (
                          <Badge className="bg-amber-100 text-amber-800 text-[8px] h-4">
                            Under Review
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                        {post.createdAt} • {post.groupName}
                      </span>
                    </div>
                  </div>

                  {/* Safeguarding Actions: Report or Block */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setReportTarget({
                          targetType: 'post',
                          targetId: post.id,
                          postId: post.id,
                          targetSnippet: post.body,
                          targetAuthor: post.author,
                        })
                      }
                      className="p-1.5 rounded-full text-muted-foreground hover:text-amber-600 hover:bg-secondary/50"
                      title="Report post to moderators"
                      aria-label="Report post"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                    {!post.isAnonymous && post.author !== user?.name && (
                      <button
                        onClick={() => handleBlockUser(post.author)}
                        className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-secondary/50"
                        title={`Block ${post.author}`}
                        aria-label={`Block ${post.author}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  {post.scriptureRef && (
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 cursor-pointer border-primary/30 text-primary"
                      onClick={() => navigate('/bible')}
                    >
                      <BookOpen className="w-3 h-3" /> {post.scriptureRef}
                    </Badge>
                  )}

                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    {post.body}
                  </p>

                  <div className="flex items-center justify-between py-2 border-y border-border/20">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={cn(
                          'flex items-center gap-1 font-bold text-xs transition-colors',
                          post.likedByMe ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'
                        )}
                      >
                        <Heart className={cn('w-4 h-4', post.likedByMe && 'fill-current')} /> {post.likes}
                      </button>

                      <button
                        onClick={() => handlePrayForPost(post.id)}
                        className={cn(
                          'flex items-center gap-1 font-bold text-xs transition-colors',
                          post.prayedByMe ? 'text-emerald-600' : 'text-muted-foreground hover:text-emerald-600'
                        )}
                      >
                        <Sparkles className="w-4 h-4" /> Prayed ({post.prayedCount || 0})
                      </button>

                      <button
                        onClick={() => setOpenCommentsPostId(commentsOpen ? null : post.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary font-bold text-xs"
                      >
                        <MessageSquare className="w-4 h-4" /> {visibleComments.length}
                      </button>
                    </div>

                    <button
                      onClick={() => handleShare(post)}
                      className="flex items-center gap-1 text-muted-foreground hover:text-primary font-bold text-xs uppercase"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                  </div>

                  {commentsOpen && (
                    <div className="space-y-2.5 pt-1">
                      {visibleComments.map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-xl bg-secondary/30 text-xs space-y-0.5 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary">{c.author}</span>
                              <span className="text-[10px] text-muted-foreground">{c.createdAt}</span>
                            </div>
                            <p className="text-muted-foreground">{c.text}</p>
                          </div>
                          <button
                            onClick={() =>
                              setReportTarget({
                                targetType: 'comment',
                                targetId: c.id,
                                postId: post.id,
                                targetSnippet: c.text,
                                targetAuthor: c.author,
                              })
                            }
                            className="text-muted-foreground hover:text-amber-600 p-1"
                            title="Report comment"
                            aria-label="Report comment"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <Input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          placeholder="Write an encouraging, Scripture-honoring reply..."
                          className="h-9 text-xs"
                        />
                        <Button size="sm" className="h-9 px-3" onClick={() => handleAddComment(post.id)}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Controlled Prayer & Fellowship Sharing Dialog */}
      <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share with Privacy & Safeguarding Controls</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {/* Category Selector */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Post Type</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {(
                  [
                    { key: 'testimony', label: 'Testimony' },
                    { key: 'prayer_request', label: 'Prayer Request' },
                    { key: 'scripture_reflection', label: 'Scripture Note' },
                    { key: 'question', label: 'Study Question' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setPostCategory(cat.key)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-left',
                      postCategory === cat.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/60 text-secondary-foreground'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Control Selector */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase">
                Privacy & Visibility Scope
              </label>
              <div className="space-y-1.5 mt-1">
                {(
                  [
                    {
                      key: 'private_only',
                      label: 'Private Prayer List Only (Not Shared)',
                      desc: 'Saved strictly to your personal Journal & Prayer Tracker',
                      icon: Lock,
                    },
                    {
                      key: 'group_only',
                      label: 'Fellowship Group Members Only',
                      desc: `Visible only inside ${postGroup}`,
                      icon: Users,
                    },
                    {
                      key: 'community_public',
                      label: 'Fellowship Community Feed',
                      desc: 'Visible to all believers in the community feed',
                      icon: Globe,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPrivacyScope(opt.key)}
                    className={cn(
                      'w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all',
                      privacyScope === opt.key
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:bg-secondary/30'
                    )}
                  >
                    <opt.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-primary">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {privacyScope !== 'private_only' && (
              <>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Fellowship Group</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {FELLOWSHIP_GROUPS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setPostGroup(g.name)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
                          postGroup === g.name
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={cn(
                    'w-full p-2 rounded-xl border text-xs font-semibold flex items-center justify-between',
                    isAnonymous ? 'border-amber-500 bg-amber-500/10 text-amber-800' : 'border-border/50 text-muted-foreground'
                  )}
                >
                  <span>Post Anonymously (Hide my name on sensitive prayer needs)</span>
                  <Badge variant={isAnonymous ? 'default' : 'outline'} className="text-[10px]">
                    {isAnonymous ? 'Anonymous' : 'Named'}
                  </Badge>
                </button>
              </>
            )}

            <Input
              value={scriptureRef}
              onChange={(e) => setScriptureRef(e.target.value)}
              placeholder="Linked Scripture (optional, e.g. Romans 8:28)"
              className="text-xs"
            />

            <Textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="Share a testimony, Scripture reflection, or prayer request..."
              className="min-h-[110px] text-xs"
            />

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewPostOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreatePost}>
                {privacyScope === 'private_only' ? 'Save Privately' : 'Publish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Content Modal */}
      <Dialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-600" /> Report Content for Moderation
            </DialogTitle>
          </DialogHeader>
          {reportTarget && (
            <div className="space-y-3 mt-1">
              <p className="text-xs text-muted-foreground">
                Reporting {reportTarget.targetType} by <strong>{reportTarget.targetAuthor}</strong>:
              </p>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReportReason(r.value)}
                    className={cn(
                      'w-full p-2.5 rounded-xl border text-left text-xs font-medium transition-all',
                      reportReason === r.value
                        ? 'border-primary bg-primary/5 font-bold'
                        : 'border-border/50 hover:bg-secondary/40'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Additional context for moderators (optional)..."
                className="min-h-[70px] text-xs"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setReportTarget(null)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSubmitReport}>
                  Submit Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Community Rules & Safeguarding Dialog */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Community Covenant & Safeguarding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2.5">
              {COMMUNITY_RULES.map((rule) => (
                <div key={rule.title} className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-1">
                  <h4 className="text-xs font-bold text-primary">{rule.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border/40 space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">
                Blocked Authors ({blockedAuthors.length})
              </h4>
              {blockedAuthors.length === 0 ? (
                <p className="text-xs text-muted-foreground">You have not blocked any community authors.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {blockedAuthors.map((name) => (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="text-xs gap-1 cursor-pointer"
                      onClick={() => handleBlockUser(name)}
                    >
                      {name} (Tap to Unblock)
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
