'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  Award,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';

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
  revieweeComments: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  reviewer: {
    user: { firstName: string; lastName: string };
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  attendance:      'Attendance & Punctuality',
  taskCompletion:  'Task Completion',
  qualityOfWork:   'Quality of Work',
  communication:   'Communication',
  teamwork:        'Teamwork & Collaboration',
  initiative:      'Initiative & Problem Solving',
  timeManagement:  'Time Management',
  professionalism: 'Professionalism',
};

const formatPeriod = (start: string, end: string, cycle: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (cycle === 'ANNUAL') {
    return `Annual ${startDate.getFullYear()}`;
  }

  const quarter = Math.ceil((endDate.getMonth() + 1) / 3);
  return `Q${quarter} ${endDate.getFullYear()}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="secondary">Draft</Badge>;
    case 'IN_PROGRESS':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">In Progress</Badge>;
    case 'COMPLETED':
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pending Acknowledgement</Badge>;
    case 'ACKNOWLEDGED':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getRatingColor = (rating: number) => {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-blue-600';
  if (rating >= 2.5) return 'text-yellow-600';
  return 'text-red-600';
};

export default function ReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);
  const [acknowledgeComments, setAcknowledgeComments] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/hr/reviews/my');
      const data = res?.data || res;
      setReviews(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch reviews:', err);
      toast.error(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledge = async () => {
    if (!selectedReview) return;

    setActionLoading(selectedReview.id);
    try {
      await api.post(`/hr/reviews/${selectedReview.id}/acknowledge`, {
        revieweeComments: acknowledgeComments.trim() || undefined,
      });
      toast.success('Review acknowledged successfully!');
      setAcknowledgeDialogOpen(false);
      setSelectedReview(null);
      setAcknowledgeComments('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to acknowledge review');
    } finally {
      setActionLoading(null);
    }
  };

  const openAcknowledgeDialog = (review: PerformanceReview) => {
    setSelectedReview(review);
    setAcknowledgeComments('');
    setAcknowledgeDialogOpen(true);
  };

  // Separate current and past reviews
  const currentReviews = reviews.filter(
    (r) => r.status === 'DRAFT' || r.status === 'IN_PROGRESS' || r.status === 'COMPLETED'
  );
  const pastReviews = reviews.filter((r) => r.status === 'ACKNOWLEDGED');

  // Get pending acknowledgement count
  const pendingAcknowledgement = reviews.filter((r) => r.status === 'COMPLETED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Reviews</h1>
          <p className="text-muted-foreground">Track your performance and career growth</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Acknowledgement Alert */}
      {pendingAcknowledgement > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800 dark:text-yellow-200">
                You have <strong>{pendingAcknowledgement}</strong> review{pendingAcknowledgement > 1 ? 's' : ''} pending acknowledgement
              </span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Current Reviews */}
      {currentReviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/20 border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Current Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentReviews.map((review) => {
                const reviewerName = `${review.reviewer.user.firstName} ${review.reviewer.user.lastName}`;
                const reviewerInitials = `${review.reviewer.user.firstName[0]}${review.reviewer.user.lastName[0]}`;
                const period = formatPeriod(review.periodStart, review.periodEnd, review.cycle);
                const needsAcknowledgement = review.status === 'COMPLETED';

                return (
                  <div
                    key={review.id}
                    className={`p-4 rounded-lg border ${
                      needsAcknowledgement
                        ? 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800'
                        : 'bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary text-white">
                            {reviewerInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{period}</h3>
                            {getStatusBadge(review.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Reviewer: {reviewerName}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Period: {formatDate(review.periodStart)} - {formatDate(review.periodEnd)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {review.overallRating && (
                          <div className="text-center">
                            <p className={`text-2xl font-bold ${getRatingColor(review.overallRating)}`}>
                              {review.overallRating.toFixed(1)}
                            </p>
                            <p className="text-xs text-muted-foreground">out of 5.0</p>
                          </div>
                        )}
                        {needsAcknowledgement && (
                          <Button
                            onClick={() => openAcknowledgeDialog(review)}
                            className="gap-2"
                            disabled={actionLoading === review.id}
                          >
                            {actionLoading === review.id && <Loader2 className="w-4 h-4 animate-spin" />}
                            <CheckCircle2 className="w-4 h-4" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Category scores + feedback */}
                    {review.status === 'COMPLETED' && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Category breakdown */}
                        {review.ratings && Object.keys(review.ratings).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Category Scores</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                              {Object.entries(review.ratings).map(([key, score]) => (
                                <div key={key} className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[key] || key}</span>
                                  <span className="text-xs font-semibold ml-2">{score}/10</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {review.strengths && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Strengths</p>
                            <p className="text-sm">{review.strengths}</p>
                          </div>
                        )}
                        {review.areasForImprovement && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Areas for Improvement</p>
                            <p className="text-sm">{review.areasForImprovement}</p>
                          </div>
                        )}
                        {review.goals && Array.isArray(review.goals) && review.goals.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Goals for Next Period</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {review.goals.map((g: any, i: number) => (
                                <li key={i} className="text-sm">{typeof g === 'string' ? g : JSON.stringify(g)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Past Reviews */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Review History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pastReviews.length === 0 && currentReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No reviews yet</p>
                <p className="text-sm">Your performance reviews will appear here</p>
              </div>
            ) : pastReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No completed reviews yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastReviews.map((review) => {
                  const reviewerName = `${review.reviewer.user.firstName} ${review.reviewer.user.lastName}`;
                  const period = formatPeriod(review.periodStart, review.periodEnd, review.cycle);

                  return (
                    <div
                      key={review.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Star className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{period}</p>
                          <p className="text-sm text-muted-foreground">
                            Reviewer: {reviewerName}
                            {review.acknowledgedAt && (
                              <> &bull; Acknowledged: {formatDate(review.acknowledgedAt)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${review.overallRating ? getRatingColor(review.overallRating) : 'text-muted-foreground'}`}>
                            {review.overallRating ? review.overallRating.toFixed(1) : '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">out of 5.0</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Acknowledge Dialog */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Acknowledge Review</DialogTitle>
            <DialogDescription>
              By acknowledging, you confirm that you have read and understood your performance review.
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {formatPeriod(selectedReview.periodStart, selectedReview.periodEnd, selectedReview.cycle)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reviewer: {selectedReview.reviewer.user.firstName} {selectedReview.reviewer.user.lastName}
                    </p>
                  </div>
                  {selectedReview.overallRating && (
                    <div className="text-center">
                      <p className={`text-xl font-bold ${getRatingColor(selectedReview.overallRating)}`}>
                        {selectedReview.overallRating.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  placeholder="Add any comments or feedback about this review..."
                  value={acknowledgeComments}
                  onChange={(e) => setAcknowledgeComments(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAcknowledge}
              disabled={actionLoading === selectedReview?.id}
              className="gap-2"
            >
              {actionLoading === selectedReview?.id && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCircle2 className="w-4 h-4" />
              Acknowledge Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
