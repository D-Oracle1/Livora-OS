'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AwardBanner } from '@/components/award-banner';
import { Crown, Loader2, Newspaper, Copy, Check, Users2, Link } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import { getUser } from '@/lib/auth-storage';
import WelcomeHeader from '@/components/engagement/welcome-header';
import FeatureSpotlight from '@/components/engagement/feature-spotlight';
import TrendingSidebar from '@/components/engagement/trending-sidebar';
import PostCard, { PostData } from '@/components/engagement/post-card';
import PostDetailDialog from '@/components/engagement/post-detail-dialog';

const POST_TYPES = [
  { value: 'ALL', label: 'All Types' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
  { value: 'PRODUCT_UPDATE', label: 'Product Updates' },
  { value: 'EDUCATIONAL_TIP', label: 'Tips' },
  { value: 'EVENT', label: 'Events' },
  { value: 'CASE_STUDY', label: 'Case Studies' },
  { value: 'SPONSORED_FEATURE', label: 'Featured' },
];

interface FeedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ClientDashboard() {
  // Feed state
  const [posts, setPosts] = useState<PostData[]>([]);
  const [meta, setMeta] = useState<FeedMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<PostData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Sidebar extras
  const [clientOfMonth, setClientOfMonth] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user?.referralCode) setReferralCode(user.referralCode);
  }, []);

  useEffect(() => {
    api
      .get('/awards/client-of-month')
      .then((res: any) => {
        const award = res?.data !== undefined ? res.data : res;
        setClientOfMonth(award && award.user ? award : null);
      })
      .catch(() => setClientOfMonth(null));
  }, []);

  const handleCopyReferral = () => {
    const link = `${window.location.origin}/auth/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Feed fetching
  const fetchPosts = useCallback(async (pageNum: number, type: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '10' });
      if (type !== 'ALL') params.set('type', type);
      const res = await api.get<{ data: PostData[]; meta: FeedMeta }>(`/engagement/feed?${params}`);
      const newPosts = res.data || [];
      const newMeta = res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
      setPosts((prev) => (append ? [...prev, ...newPosts] : newPosts));
      setMeta(newMeta);
    } catch {
      toast.error('Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPosts(1, typeFilter, false);
  }, [typeFilter, fetchPosts]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, typeFilter, true);
  };

  const handleReact = useCallback(async (postId: string, type: string) => {
    // Optimistic update — apply immediately, rollback on failure
    let snapshot: PostData | undefined;
    setPosts((prev) => {
      snapshot = prev.find((p) => p.id === postId);
      return prev.map((p) => {
        if (p.id !== postId) return p;
        const toggleOff = p.userReaction === type;
        return {
          ...p,
          userReaction: toggleOff ? null : type,
          reactionCount: toggleOff
            ? Math.max(0, p.reactionCount - 1)
            : p.userReaction ? p.reactionCount : p.reactionCount + 1,
        };
      });
    });
    try {
      await api.post(`/engagement/feed/${postId}/react`, { type });
    } catch {
      if (snapshot) {
        const rollback = snapshot;
        setPosts((prev) => prev.map((p) => (p.id === postId ? rollback : p)));
      }
      toast.error('Failed to react');
    }
  }, []);

  const handleSave = useCallback(async (postId: string) => {
    // Optimistic toggle
    let prevSaved: boolean | undefined;
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      prevSaved = p.isSaved;
      return { ...p, isSaved: !p.isSaved };
    }));
    try {
      const res = await api.post<any>(`/engagement/feed/${postId}/save`);
      const data = res?.data ?? res;
      toast.success(data.saved ? 'Post saved' : 'Post unsaved');
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: !!prevSaved } : p)));
      toast.error('Failed to save post');
    }
  }, []);

  const handleShare = async (postId: string) => {
    try {
      await api.post(`/engagement/feed/${postId}/share`);
      toast.success('Shared internally');
    } catch {
      toast.error('Failed to share');
    }
  };

  const handleOpenDetail = (postId: string) => {
    setDetailPostId(postId);
    setDetailPost(posts.find((p) => p.id === postId) ?? null);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-5">
      <AwardBanner />

      {/* Client of the Month */}
      {clientOfMonth && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-[#fca639] to-[#e8953a] text-white shadow-sm border-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-yellow-200" />
                <span className="text-sm font-semibold opacity-90">Client of the Month</span>
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-white/30">
                  {clientOfMonth.user?.avatar && (
                    <AvatarImage src={getImageUrl(clientOfMonth.user.avatar)} alt={clientOfMonth.user?.firstName} />
                  )}
                  <AvatarFallback className="bg-white/20 text-white text-lg">
                    {(clientOfMonth.user?.firstName?.[0] || '') + (clientOfMonth.user?.lastName?.[0] || '')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold">
                    {clientOfMonth.user?.firstName} {clientOfMonth.user?.lastName}
                  </h3>
                  <p className="text-xs text-white/80">
                    {new Date(0, clientOfMonth.month - 1).toLocaleString('en', { month: 'long' })} {clientOfMonth.year}
                  </p>
                </div>
              </div>
              {clientOfMonth.reason && (
                <p className="mt-3 text-sm text-white/80 bg-white/10 rounded-lg p-2.5">{clientOfMonth.reason}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Smart Welcome Header */}
      <WelcomeHeader />

      {/* Main content: feed + right sidebar */}
      <div className="flex gap-5 items-start">
        {/* Center: Engagement Feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {POST_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Posts */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground text-sm">Loading feed...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="text-muted-foreground text-sm">No posts available yet</p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={handleReact}
                  onSave={handleSave}
                  onOpenDetail={handleOpenDetail}
                  onShare={handleShare}
                />
              ))}
              {page < meta.totalPages && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
          <TrendingSidebar />
          <FeatureSpotlight />

          {/* Referral card */}
          {referralCode && (
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-[#2b1464]/10 flex items-center justify-center">
                    <Link className="w-3.5 h-3.5 text-[#2b1464]" />
                  </div>
                  <p className="text-sm font-semibold">Your Referral</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3 break-all">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/auth/register?ref=${referralCode}`
                    : referralCode}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyReferral} className="flex-1 gap-1.5 text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </Button>
                  <Button size="sm" className="flex-1 bg-[#2b1464] hover:bg-[#1e0e47] text-white text-xs gap-1.5" asChild>
                    <a href="/dashboard/client/referrals">
                      <Users2 className="w-3.5 h-3.5" />
                      Leads
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <PostDetailDialog
        postId={detailPostId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        preloadedPost={detailPost ?? undefined}
      />
    </div>
  );
}
