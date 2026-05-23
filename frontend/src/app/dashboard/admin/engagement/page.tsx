'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Send,
  Eye,
  Heart,
  BarChart3,
  Upload,
  FileText,
  TrendingUp,
  MessageSquare,
  Sparkles,
  Clock,
  Archive,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { ImageCropModal } from '@/components/ui/image-crop-modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostType =
  | 'ANNOUNCEMENT'
  | 'PRODUCT_UPDATE'
  | 'EDUCATIONAL_TIP'
  | 'EVENT'
  | 'POLL'
  | 'CASE_STUDY'
  | 'SPONSORED_FEATURE';

type PostStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

interface Post {
  id: string;
  title: string;
  type: PostType;
  status: PostStatus;
  content: string;
  excerpt?: string;
  mediaUrl?: string;
  externalLink?: string;
  tags: string[];
  scheduledAt?: string;
  expiresAt?: string;
  isPinned: boolean;
  commentsDisabled: boolean;
  viewCount: number;
  reactionCount: number;
  commentCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PostMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Analytics {
  totalPosts: number;
  published: number;
  totalViews: number;
  totalReactions: number;
  totalComments: number;
  avgEngagementRate: number;
  typeBreakdown: Record<string, number>;
}

interface PostFormData {
  title: string;
  type: PostType;
  content: string;
  excerpt: string;
  mediaUrl: string;
  externalLink: string;
  tags: string[];
  scheduledAt: string;
  expiresAt: string;
  isPinned: boolean;
  commentsDisabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POST_TYPES: PostType[] = [
  'ANNOUNCEMENT',
  'PRODUCT_UPDATE',
  'EDUCATIONAL_TIP',
  'EVENT',
  'POLL',
  'CASE_STUDY',
  'SPONSORED_FEATURE',
];

const POST_TYPE_LABELS: Record<PostType, string> = {
  ANNOUNCEMENT: 'Announcement',
  PRODUCT_UPDATE: 'Product Update',
  EDUCATIONAL_TIP: 'Educational Tip',
  EVENT: 'Event',
  POLL: 'Poll',
  CASE_STUDY: 'Case Study',
  SPONSORED_FEATURE: 'Sponsored Feature',
};

const POST_TYPE_COLORS: Record<PostType, string> = {
  ANNOUNCEMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PRODUCT_UPDATE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  EDUCATIONAL_TIP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  EVENT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  POLL: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  CASE_STUDY: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  SPONSORED_FEATURE: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
};

const POST_TYPE_ACCENT: Record<PostType, string> = {
  ANNOUNCEMENT: 'bg-blue-500',
  PRODUCT_UPDATE: 'bg-purple-500',
  EDUCATIONAL_TIP: 'bg-emerald-500',
  EVENT: 'bg-orange-500',
  POLL: 'bg-cyan-500',
  CASE_STUDY: 'bg-indigo-500',
  SPONSORED_FEATURE: 'bg-pink-500',
};

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string; bar: string; icon: React.FC<any> }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', bar: 'bg-gray-300 dark:bg-gray-600', icon: Circle },
  PUBLISHED: { label: 'Published', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', bar: 'bg-green-500', icon: CheckCircle2 },
  SCHEDULED: { label: 'Scheduled', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', bar: 'bg-yellow-400', icon: Clock },
  ARCHIVED: { label: 'Archived', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', bar: 'bg-red-400', icon: Archive },
};

const STAT_CARDS = [
  {
    key: 'totalPosts' as const,
    title: 'Total Posts',
    icon: FileText,
    gradient: 'from-blue-500 to-blue-600',
    glow: 'shadow-blue-500/30',
  },
  {
    key: 'totalViews' as const,
    title: 'Total Views',
    icon: Eye,
    gradient: 'from-purple-500 to-violet-600',
    glow: 'shadow-purple-500/30',
  },
  {
    key: 'avgEngagementRate' as const,
    title: 'Engagement Rate',
    icon: TrendingUp,
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/30',
    format: (v: number) => `${(v || 0).toFixed(1)}%`,
  },
  {
    key: 'totalReactions' as const,
    title: 'Reactions',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/30',
  },
];

const TAG_OPTIONS = ['CLIENT', 'REALTOR', 'STAFF'] as const;

const EMPTY_FORM: PostFormData = {
  title: '',
  type: 'ANNOUNCEMENT',
  content: '',
  excerpt: '',
  mediaUrl: '',
  externalLink: '',
  tags: [],
  scheduledAt: '',
  expiresAt: '',
  isPinned: false,
  commentsDisabled: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EngagementPage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'analytics'>('posts');

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<PostMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [form, setForm] = useState<PostFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const pendingUploadRef = useRef<((f: File) => Promise<void>) | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const res = await api.get<{ data: Post[]; meta: PostMeta }>(`/engagement/posts?${params}`);
      setPosts(res.data || []);
      setMeta(res.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get<any>('/engagement/analytics');
      setAnalytics(res?.data ?? res);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'posts') fetchPosts();
    else fetchAnalytics();
  }, [activeTab, fetchPosts, fetchAnalytics]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateForm = (field: keyof PostFormData, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleTag = (tag: string) =>
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));

  const openCreateDialog = () => {
    setEditingPost(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (post: Post) => {
    setEditingPost(post);
    setForm({
      title: post.title,
      type: post.type,
      content: post.content,
      excerpt: post.excerpt || '',
      mediaUrl: post.mediaUrl || '',
      externalLink: post.externalLink || '',
      tags: post.tags || [],
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '',
      expiresAt: post.expiresAt ? new Date(post.expiresAt).toISOString().slice(0, 16) : '',
      isPinned: post.isPinned,
      commentsDisabled: post.commentsDisabled,
    });
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {
      title: form.title,
      type: form.type,
      content: form.content,
    };
    if (form.excerpt) payload.excerpt = form.excerpt;
    if (form.mediaUrl) payload.mediaUrl = form.mediaUrl;
    if (form.externalLink) payload.externalLink = form.externalLink;
    if (form.tags.length > 0) payload.tags = form.tags;
    if (form.scheduledAt) payload.scheduledAt = new Date(form.scheduledAt).toISOString();
    if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();
    payload.isPinned = form.isPinned;
    payload.commentsDisabled = form.commentsDisabled;
    return payload;
  };

  const handleSaveDraft = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editingPost) {
        await api.put(`/engagement/posts/${editingPost.id}`, payload);
        toast.success('Post updated');
      } else {
        await api.post('/engagement/posts', payload);
        toast.success('Post saved as draft');
      }
      setDialogOpen(false);
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save post');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let postId: string;
      if (editingPost) {
        await api.put(`/engagement/posts/${editingPost.id}`, payload);
        postId = editingPost.id;
      } else {
        const created = await api.post<any>('/engagement/posts', payload);
        postId = (created?.data ?? created)?.id;
      }
      await api.post(`/engagement/posts/${postId}/publish`);
      toast.success('Post published successfully');
      setDialogOpen(false);
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (post: Post) => {
    try {
      if (post.status === 'PUBLISHED') {
        await api.put(`/engagement/posts/${post.id}`, { status: 'DRAFT' });
        toast.success('Post unpublished');
      } else {
        await api.post(`/engagement/posts/${post.id}/publish`);
        toast.success('Post published');
      }
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update post');
    }
  };

  const handleDelete = async (post: Post) => {
    if (!confirm(`Archive "${post.title}"?`)) return;
    try {
      await api.delete(`/engagement/posts/${post.id}`);
      toast.success('Post archived');
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive post');
    }
  };

  const handleMediaUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file: File | undefined = e.target.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { toast.error('Image must be under 4 MB'); return; }
      pendingUploadRef.current = async (cropped) => {
        setUploading(true);
        try {
          const urls = await api.uploadFiles('/upload/cms-images', [cropped], 'images');
          if (urls?.length) { updateForm('mediaUrl', urls[0]); toast.success('Image uploaded'); }
        } catch {
          toast.error('Failed to upload image');
        } finally {
          setUploading(false);
        }
      };
      setCropFile(file);
    };
    input.click();
  };

  const handleCropDone = async (croppedFile: File) => {
    setCropFile(null);
    const upload = pendingUploadRef.current;
    pendingUploadRef.current = null;
    if (upload) await upload(croppedFile);
  };

  // ---------------------------------------------------------------------------
  // Render: Posts tab
  // ---------------------------------------------------------------------------

  const renderPostsTab = () => (
    <>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[150px] rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {(Object.keys(STATUS_CONFIG) as PostStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {POST_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{POST_TYPE_LABELS[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          onClick={openCreateDialog}
          className="w-full sm:w-auto bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-md rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Post
        </Button>
      </div>

      {/* Posts card list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-emerald-500/10 flex items-center justify-center">
            <FileText className="w-8 h-8 text-primary/50" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700 dark:text-gray-300">No posts yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first engagement post</p>
          </div>
          <Button onClick={openCreateDialog} className="rounded-xl bg-gradient-to-r from-primary to-emerald-500">
            <Plus className="w-4 h-4 mr-2" /> Create Post
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const statusCfg = STATUS_CONFIG[post.status];
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={post.id}
                className="group flex items-stretch gap-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                {/* Left status bar */}
                <div className={cn('w-1.5 shrink-0', statusCfg.bar)} />

                {/* Content */}
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    {/* Type accent dot */}
                    <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', POST_TYPE_ACCENT[post.type])} />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1 min-w-0 leading-snug">
                      {post.title}
                    </h3>
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', POST_TYPE_COLORS[post.type])}>
                      {POST_TYPE_LABELS[post.type]}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', statusCfg.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />{formatNumber(post.viewCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />{formatNumber(post.reactionCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />{formatNumber(post.commentCount)}
                    </span>
                    {post.publishedAt && (
                      <span className="text-gray-300 dark:text-gray-600">{formatDate(post.publishedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Actions — always visible on mobile, hover on desktop */}
                <div className="flex items-center gap-1 px-3 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => openEditDialog(post)}
                    title="Edit"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all duration-200"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleTogglePublish(post)}
                    title={post.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
                      post.status === 'PUBLISHED'
                        ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(post)}
                    title="Archive"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl">
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-1">{page} / {meta.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} className="rounded-xl">
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Render: Analytics tab
  // ---------------------------------------------------------------------------

  const renderAnalyticsTab = () => {
    if (analyticsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      );
    }
    if (!analytics) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-emerald-500/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-primary/50" />
          </div>
          <p className="text-muted-foreground">No analytics data yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Gradient stat cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map((stat) => {
            const rawVal = analytics[stat.key as keyof Analytics] as number;
            const displayVal = stat.format ? stat.format(rawVal) : formatNumber(rawVal);
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className={cn(
                  'relative overflow-hidden rounded-2xl p-5 text-white',
                  `bg-gradient-to-br ${stat.gradient}`,
                  `shadow-lg ${stat.glow}`
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-3xl font-bold tracking-tight">{displayVal}</span>
                </div>
                <p className="text-sm font-medium opacity-90">{stat.title}</p>
                {/* Decorative circle */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
              </div>
            );
          })}
        </div>

        {/* Type breakdown */}
        <Card className="rounded-2xl border-gray-100 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              Posts by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.typeBreakdown && Object.keys(analytics.typeBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(analytics.typeBreakdown).map(([type, count]) => {
                  const postType = type as PostType;
                  const maxCount = Math.max(...Object.values(analytics.typeBreakdown));
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  const typeColors: Record<string, string> = {
                    ANNOUNCEMENT: 'bg-blue-500',
                    PRODUCT_UPDATE: 'bg-purple-500',
                    EDUCATIONAL_TIP: 'bg-emerald-500',
                    EVENT: 'bg-orange-500',
                    POLL: 'bg-cyan-500',
                    CASE_STUDY: 'bg-indigo-500',
                    SPONSORED_FEATURE: 'bg-pink-500',
                  };
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-full w-[140px] text-center shrink-0', POST_TYPE_COLORS[postType])}>
                        {POST_TYPE_LABELS[postType] || type}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', typeColors[type] || 'bg-primary')}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right text-gray-700 dark:text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Dialog
  // ---------------------------------------------------------------------------

  const renderDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingPost ? 'Edit Post' : 'Create Post'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Enter post title"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Post Type *</label>
            <Select value={form.type} onValueChange={(v) => updateForm('type', v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{POST_TYPE_LABELS[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Content *</label>
            <Textarea
              placeholder="Write your post content..."
              value={form.content}
              onChange={(e) => updateForm('content', e.target.value)}
              rows={6}
              className="rounded-xl resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Excerpt</label>
            <Textarea
              placeholder="Short summary (optional)"
              value={form.excerpt}
              onChange={(e) => updateForm('excerpt', e.target.value)}
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Media</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Media URL"
                value={form.mediaUrl}
                onChange={(e) => updateForm('mediaUrl', e.target.value)}
                className="flex-1 rounded-xl"
              />
              <Button type="button" variant="outline" onClick={handleMediaUpload} disabled={uploading} className="rounded-xl">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="ml-2 hidden sm:inline">Upload</span>
              </Button>
            </div>
            {form.mediaUrl && (
              <img
                src={form.mediaUrl}
                alt="Preview"
                className="mt-2 w-full max-h-40 object-cover rounded-xl border"
              />
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">External Link URL</label>
            <Input
              placeholder="https://example.com"
              value={form.externalLink}
              onChange={(e) => updateForm('externalLink', e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Target Audience</label>
            <p className="text-xs text-muted-foreground mb-2">Select who should see this post. If none, all users see it.</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <label
                  key={tag}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer transition-colors text-sm',
                    form.tags.includes(tag)
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-input hover:bg-muted'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.tags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                    className="rounded"
                  />
                  {tag.charAt(0) + tag.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Schedule Date</label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => updateForm('scheduledAt', e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Expiry Date</label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => updateForm('expiresAt', e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
            <div className="flex items-center gap-3">
              <Switch checked={form.isPinned} onCheckedChange={(v) => updateForm('isPinned', v)} />
              <label className="text-sm font-medium">Pin Post</label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.commentsDisabled} onCheckedChange={(v) => updateForm('commentsDisabled', v)} />
              <label className="text-sm font-medium">Disable Comments</label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSaveDraft} disabled={submitting} className="rounded-xl">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save as Draft
          </Button>
          <Button
            onClick={handlePublish}
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <>
    <ImageCropModal
      file={cropFile}
      onCrop={handleCropDone}
      onClose={() => { setCropFile(null); pendingUploadRef.current = null; }}
    />
    <div className="space-y-6">
      {/* Page header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-emerald-600 to-teal-500 p-5 sm:p-6 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 opacity-80" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Content Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Engagement Management</h1>
          <p className="text-sm opacity-75 mt-0.5">Create and manage posts for your audience</p>
        </div>
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-white/10 rounded-full blur-sm" />
        <div className="absolute right-20 -top-4 w-12 h-12 bg-white/10 rounded-full" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('posts')}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'posts'
              ? 'bg-gradient-to-r from-primary to-emerald-500 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/40 hover:text-primary'
          )}
        >
          <FileText className="w-4 h-4" />
          Posts
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
            activeTab === 'analytics'
              ? 'bg-gradient-to-r from-primary to-emerald-500 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/40 hover:text-primary'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'posts' ? renderPostsTab() : renderAnalyticsTab()}

      {renderDialog()}
    </div>
    </>
  );
}
