'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Search,
  Globe,
  MapPin,
  Users,
  Eye,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Event {
  id: string;
  title: string;
  slug: string;
  locationType: 'physical' | 'online';
  eventDate: string;
  registrationDeadline: string | null;
  maxAttendees: number | null;
  status: 'draft' | 'published' | 'closed';
  isFeatured: boolean;
  _count: { registrations: number };
  analytics: { viewsCount: number; registrationsCount: number } | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await api.get<{ data: Event[]; meta: { totalPages: number } }>(
        `/events?${params}`,
      );
      setEvents(Array.isArray(res.data) ? res.data : []);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/events/${deleteTarget.id}`);
      toast.success('Event deleted');
      setDeleteTarget(null);
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(event: Event, newStatus: string) {
    setStatusUpdating(event.id);
    try {
      await api.patch(`/events/${event.id}/status`, { status: newStatus });
      toast.success(`Event ${newStatus}`);
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message || 'Status update failed');
    } finally {
      setStatusUpdating(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all platform events</p>
        </div>
        <Link href="/dashboard/admin/events/create">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchEvents}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Calendar className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500">No events found</p>
          <Link href="/dashboard/admin/events/create">
            <Button size="sm">Create your first event</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev, i) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate max-w-xs">
                          {ev.title}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[ev.status]}`}
                        >
                          {ev.status}
                        </span>
                        {ev.isFeatured && (
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(ev.eventDate).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          {ev.locationType === 'online' ? (
                            <Globe className="w-3 h-3" />
                          ) : (
                            <MapPin className="w-3 h-3" />
                          )}
                          {ev.locationType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {ev._count.registrations}
                          {ev.maxAttendees ? ` / ${ev.maxAttendees}` : ''} registered
                        </span>
                        {ev.analytics && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {ev.analytics.viewsCount} views
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status toggle */}
                      {ev.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-300 hover:bg-green-50 text-xs gap-1"
                          onClick={() => handleStatusChange(ev, 'published')}
                          disabled={statusUpdating === ev.id}
                        >
                          {statusUpdating === ev.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          Publish
                        </Button>
                      )}
                      {ev.status === 'published' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 border-orange-300 hover:bg-orange-50 text-xs gap-1"
                          onClick={() => handleStatusChange(ev, 'closed')}
                          disabled={statusUpdating === ev.id}
                        >
                          {statusUpdating === ev.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Close
                        </Button>
                      )}

                      <Link href={`/dashboard/admin/events/${ev.id}`}>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </Link>

                      <Link href={`/dashboard/admin/events/${ev.id}/registrations`}>
                        <Button variant="ghost" size="icon">
                          <Users className="w-4 h-4" />
                        </Button>
                      </Link>

                      <Link href={`/dashboard/admin/events/${ev.id}/checkin`}>
                        <Button variant="ghost" size="icon">
                          <BarChart2 className="w-4 h-4" />
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => setDeleteTarget(ev)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-600 px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget?.title}</strong>? This will also remove all
              registrations and analytics. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
