'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
  Loader2,
  RefreshCw,
  ClipboardList,
  ChevronRight,
  Send,
  X,
  User,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PerformanceReview {
  id: string;
  cycle: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  overallRating: number | null;
  ratings: Record<string, number> | null;
  strengths: string | null;
  areasForImprovement: string | null;
  goals: any[] | null;
  reviewerComments: string | null;
  createdAt: string;
  reviewee: {
    id: string;
    user: { firstName: string; lastName: string; avatar: string | null };
    department: { name: string } | null;
  };
  reviewer: {
    user: { firstName: string; lastName: string };
  };
}

interface StaffMember {
  id: string;
  user: { firstName: string; lastName: string };
}

// ── Assessment categories ─────────────────────────────────────────────────────

const ASSESSMENT_CATEGORIES = [
  { key: 'attendance',      label: 'Attendance & Punctuality',    description: 'Reliability, timeliness, and consistent presence' },
  { key: 'taskCompletion',  label: 'Task Completion',             description: 'Meeting deadlines and completing assigned work' },
  { key: 'qualityOfWork',   label: 'Quality of Work',             description: 'Accuracy, thoroughness, and attention to detail' },
  { key: 'communication',   label: 'Communication',               description: 'Clarity, responsiveness, and professionalism' },
  { key: 'teamwork',        label: 'Teamwork & Collaboration',    description: 'Working effectively with colleagues and teams' },
  { key: 'initiative',      label: 'Initiative & Problem Solving', description: 'Proactivity, creativity, and going beyond the role' },
  { key: 'timeManagement',  label: 'Time Management',             description: 'Prioritisation, efficiency, and deadline adherence' },
  { key: 'professionalism', label: 'Professionalism',             description: 'Conduct, ethics, and representing the company well' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPeriod = (start: string, end: string, cycle: string) => {
  const endDate = new Date(end);
  if (cycle === 'ANNUAL') return `Annual ${endDate.getFullYear()}`;
  const quarter = Math.ceil((endDate.getMonth() + 1) / 3);
  return `Q${quarter} ${endDate.getFullYear()}`;
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT':        return <Badge variant="secondary">Draft</Badge>;
    case 'IN_PROGRESS':  return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">In Progress</Badge>;
    case 'COMPLETED':    return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pending Ack.</Badge>;
    case 'ACKNOWLEDGED': return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
    default:             return <Badge variant="secondary">{status}</Badge>;
  }
};

const getRatingColor = (rating: number | null) => {
  if (!rating) return 'text-muted-foreground';
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-blue-600';
  if (rating >= 2.5) return 'text-yellow-600';
  return 'text-red-600';
};

const scoreLabel = (score: number) => {
  if (score >= 9) return 'Exceptional';
  if (score >= 7) return 'Exceeds Expectations';
  if (score >= 5) return 'Meets Expectations';
  if (score >= 3) return 'Needs Improvement';
  return 'Unsatisfactory';
};

const scoreLabelColor = (score: number) => {
  if (score >= 9) return 'text-green-600';
  if (score >= 7) return 'text-blue-600';
  if (score >= 5) return 'text-yellow-600';
  if (score >= 3) return 'text-orange-600';
  return 'text-red-600';
};

// ── Category Score Slider ─────────────────────────────────────────────────────

function CategorySlider({
  category, value, onChange,
}: { category: typeof ASSESSMENT_CATEGORIES[0]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{category.label}</p>
          <p className="text-xs text-muted-foreground">{category.description}</p>
        </div>
        <div className="text-right min-w-[100px]">
          <span className="text-xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">/10</span>
          <p className={`text-xs font-medium ${scoreLabelColor(value)}`}>{scoreLabel(value)}</p>
        </div>
      </div>
      <Slider
        min={1} max={10} step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

// ── Evaluate Dialog ───────────────────────────────────────────────────────────

interface EvaluateDialogProps {
  review: PerformanceReview | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EvaluateDialog({ review, open, onClose, onSaved }: EvaluateDialogProps) {
  const defaultScores = () =>
    Object.fromEntries(ASSESSMENT_CATEGORIES.map((c) => [c.key, 5]));

  const [scores, setScores] = useState<Record<string, number>>(defaultScores());
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [goals, setGoals] = useState('');
  const [reviewerComments, setReviewerComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prefill existing data
  useEffect(() => {
    if (!review) return;
    if (review.ratings && typeof review.ratings === 'object') {
      setScores({ ...defaultScores(), ...review.ratings });
    } else {
      setScores(defaultScores());
    }
    setStrengths(review.strengths || '');
    setImprovements(review.areasForImprovement || '');
    setGoals(Array.isArray(review.goals) ? review.goals.join('\n') : (review.goals || ''));
    setReviewerComments(review.reviewerComments || '');
  }, [review]);

  const overallRating = +(
    Object.values(scores).reduce((a, b) => a + b, 0) /
    ASSESSMENT_CATEGORIES.length / 2
  ).toFixed(1); // maps 1–10 scale → 0.5–5.0

  const handleSave = async () => {
    if (!review) return;
    setSaving(true);
    try {
      await api.put(`/hr/reviews/${review.id}`, {
        ratings: scores,
        overallRating,
        strengths: strengths.trim() || undefined,
        areasForImprovement: improvements.trim() || undefined,
        goals: goals.trim() ? goals.trim().split('\n').filter(Boolean) : undefined,
        reviewerComments: reviewerComments.trim() || undefined,
      });
      toast.success('Assessment saved as draft');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!review) return;
    setSubmitting(true);
    try {
      // Save first, then submit
      await api.put(`/hr/reviews/${review.id}`, {
        ratings: scores,
        overallRating,
        strengths: strengths.trim() || undefined,
        areasForImprovement: improvements.trim() || undefined,
        goals: goals.trim() ? goals.trim().split('\n').filter(Boolean) : undefined,
        reviewerComments: reviewerComments.trim() || undefined,
      });
      await api.post(`/hr/reviews/${review.id}/submit`, {});
      toast.success('Review submitted — staff will be notified to acknowledge');
      onClose();
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!review) return null;

  const revieweeName = `${review.reviewee?.user?.firstName || ''} ${review.reviewee?.user?.lastName || ''}`;
  const period = formatPeriod(review.periodStart, review.periodEnd, review.cycle);
  const isReadOnly = review.status === 'COMPLETED' || review.status === 'ACKNOWLEDGED';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Performance Assessment
          </DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'Viewing submitted assessment' : 'Rate each category and provide feedback'}
          </DialogDescription>
        </DialogHeader>

        {/* Staff info strip */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Avatar className="w-10 h-10">
            {review.reviewee?.user?.avatar && (
              <AvatarImage src={getImageUrl(review.reviewee.user.avatar)} />
            )}
            <AvatarFallback className="bg-primary text-white text-xs">
              {review.reviewee?.user?.firstName?.[0]}{review.reviewee?.user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-sm">{revieweeName}</p>
            <p className="text-xs text-muted-foreground">{review.reviewee?.department?.name || 'No Department'} &bull; {period}</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${getRatingColor(overallRating)}`}>{overallRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Overall / 5.0</p>
          </div>
        </div>

        {/* Category scores */}
        <div className="space-y-5 py-2">
          <p className="text-sm font-semibold">Category Ratings</p>
          {ASSESSMENT_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <CategorySlider
                category={cat}
                value={scores[cat.key] ?? 5}
                onChange={isReadOnly ? () => {} : (v) => setScores((prev) => ({ ...prev, [cat.key]: v }))}
              />
              <Separator className="mt-4" />
            </div>
          ))}
        </div>

        {/* Text feedback */}
        <div className="space-y-4">
          <p className="text-sm font-semibold">Qualitative Feedback</p>
          <div className="space-y-2">
            <Label>Strengths</Label>
            <Textarea
              placeholder="What does this staff member do particularly well?"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Areas for Improvement</Label>
            <Textarea
              placeholder="Where can they grow or develop further?"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Goals for Next Period</Label>
            <Textarea
              placeholder="One goal per line..."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Reviewer Comments (Internal)</Label>
            <Textarea
              placeholder="Any additional internal comments..."
              value={reviewerComments}
              onChange={(e) => setReviewerComments(e.target.value)}
              rows={2}
              disabled={isReadOnly}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="w-4 h-4" />
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <>
              <Button variant="secondary" onClick={handleSave} disabled={saving || submitting} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button onClick={handleSubmit} disabled={saving || submitting} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit to Staff
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPerformancePage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newRevieweeId, setNewRevieweeId] = useState('');
  const [newCycle, setNewCycle] = useState('QUARTERLY');

  const [evaluateReview, setEvaluateReview] = useState<PerformanceReview | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (cycleFilter !== 'all') params.append('cycle', cycleFilter);

      const [reviewsRes, staffRes] = await Promise.allSettled([
        api.get<any>(`/hr/reviews?${params.toString()}`),
        api.get<any>('/staff?limit=100'),
      ]);

      if (reviewsRes.status === 'fulfilled') {
        const data = reviewsRes.value?.data?.data || reviewsRes.value?.data || [];
        setReviews(Array.isArray(data) ? data : []);
      }
      if (staffRes.status === 'fulfilled') {
        const data = staffRes.value?.data?.data || staffRes.value?.data || [];
        setStaff(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cycleFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateReview = async () => {
    if (!newRevieweeId) { toast.error('Please select a staff member'); return; }
    setCreateLoading(true);
    try {
      const now = new Date();
      let periodStart: Date, periodEnd: Date;
      if (newCycle === 'QUARTERLY') {
        const quarter = Math.floor(now.getMonth() / 3);
        periodStart = new Date(now.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      } else {
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31);
      }
      await api.post('/hr/reviews', {
        revieweeId: newRevieweeId,
        cycle: newCycle,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
      toast.success('Performance review created');
      setCreateDialogOpen(false);
      setNewRevieweeId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create review');
    } finally {
      setCreateLoading(false);
    }
  };

  // Stats
  const activeCount = reviews.filter((r) => r.status === 'DRAFT' || r.status === 'IN_PROGRESS').length;
  const completedCount = reviews.filter((r) => r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED').length;
  const avgRating = (() => {
    const rated = reviews.filter((r) => r.overallRating);
    return rated.length ? rated.reduce((s, r) => s + (r.overallRating || 0), 0) / rated.length : 0;
  })();
  const pendingAck = reviews.filter((r) => r.status === 'COMPLETED').length;

  const statsCards = [
    { label: 'Active Reviews', value: activeCount, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Avg. Rating', value: avgRating > 0 ? avgRating.toFixed(1) : '-', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Pending Ack.', value: pendingAck, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  const filteredReviews = reviews.filter((r) => {
    if (!searchQuery) return true;
    const name = `${r.reviewee?.user?.firstName || ''} ${r.reviewee?.user?.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const topPerformers = [...reviews]
    .filter((r) => r.overallRating && (r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED'))
    .sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0))
    .slice(0, 5);

  if (loading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Evaluate Dialog */}
      <EvaluateDialog
        review={evaluateReview}
        open={!!evaluateReview}
        onClose={() => setEvaluateReview(null)}
        onSaved={fetchData}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Reviews</h1>
          <p className="text-muted-foreground">Manage and assess staff performance reviews</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Create Review
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {statsCards.map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search staff..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Cycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            <SelectItem value="ANNUAL">Annual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Pending Ack.</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Reviews Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Performance Reviews
                <Badge variant="secondary">{filteredReviews.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No reviews found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                {review.reviewee?.user?.avatar && (
                                  <AvatarImage src={getImageUrl(review.reviewee.user.avatar)} />
                                )}
                                <AvatarFallback className="bg-primary text-white text-xs">
                                  {review.reviewee?.user?.firstName?.[0]}{review.reviewee?.user?.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {review.reviewee?.user?.firstName} {review.reviewee?.user?.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{review.reviewee?.department?.name || 'No Dept'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatPeriod(review.periodStart, review.periodEnd, review.cycle)}
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold ${getRatingColor(review.overallRating)}`}>
                              {review.overallRating ? review.overallRating.toFixed(1) : '-'}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(review.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={review.status === 'DRAFT' || review.status === 'IN_PROGRESS' ? 'default' : 'outline'}
                              className="gap-1.5"
                              onClick={() => setEvaluateReview(review)}
                            >
                              {review.status === 'DRAFT' || review.status === 'IN_PROGRESS' ? (
                                <><ClipboardList className="w-3.5 h-3.5" /> Evaluate</>
                              ) : (
                                <><ChevronRight className="w-3.5 h-3.5" /> View</>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Performers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No completed reviews yet</p>
              ) : (
                topPerformers.map((review, index) => (
                  <div key={review.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">
                      {index + 1}
                    </span>
                    <Avatar className="w-8 h-8 shrink-0">
                      {review.reviewee?.user?.avatar && (
                        <AvatarImage src={getImageUrl(review.reviewee.user.avatar)} />
                      )}
                      <AvatarFallback className="bg-primary text-white text-xs">
                        {review.reviewee?.user?.firstName?.[0]}{review.reviewee?.user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {review.reviewee?.user?.firstName} {review.reviewee?.user?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{review.reviewee?.department?.name || 'No Dept'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-sm">{review.overallRating?.toFixed(1)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Assessment Scale Legend */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Rating Scale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { range: '9–10', label: 'Exceptional', color: 'text-green-600' },
                { range: '7–8',  label: 'Exceeds Expectations', color: 'text-blue-600' },
                { range: '5–6',  label: 'Meets Expectations', color: 'text-yellow-600' },
                { range: '3–4',  label: 'Needs Improvement', color: 'text-orange-600' },
                { range: '1–2',  label: 'Unsatisfactory', color: 'text-red-600' },
              ].map((item) => (
                <div key={item.range} className="flex items-center justify-between text-sm">
                  <span className="font-medium w-10">{item.range}</span>
                  <span className={`${item.color} font-medium`}>{item.label}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground">Category scores (1–10) are averaged and mapped to a 5.0 overall rating.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Create Review Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Performance Review</DialogTitle>
            <DialogDescription>Start a new performance review for a staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={newRevieweeId} onValueChange={setNewRevieweeId}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.firstName} {s.user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Review Cycle *</Label>
              <Select value={newCycle} onValueChange={setNewCycle}>
                <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReview} disabled={createLoading}>
              {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
