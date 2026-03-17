'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Registration {
  id: string;
  registrationCode: string;
  userData: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
  qrCodeToken: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_STYLES: Record<string, { icon: React.ElementType; color: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
  approved: { icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  rejected: { icon: XCircle, color: 'text-red-600 bg-red-50' },
};

export default function RegistrationsPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id || '';

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [qrPreview, setQrPreview] = useState<{ code: string; token: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await api.get<{ data: Registration[]; meta: Meta }>(
        `/events/${eventId}/registrations?${params}`,
      );
      setRegistrations(Array.isArray(res.data) ? res.data : []);
      if (res.meta) setMeta(res.meta);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [eventId, page, statusFilter]);

  useEffect(() => { fetchRegistrations(); }, [fetchRegistrations]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      await api.patch(`/events/registrations/${id}/status`, { status });
      toast.success(`Registration ${status}`);
      fetchRegistrations();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  }

  function exportCSV() {
    if (registrations.length === 0) { toast.error('No registrations to export'); return; }
    const allKeys = new Set<string>();
    registrations.forEach((r) => Object.keys(r.userData).forEach((k) => allKeys.add(k)));
    const keys = Array.from(allKeys);
    const header = ['Registration Code', 'Status', 'Checked In', 'Registered At', ...keys];
    const rows = registrations.map((r) => [
      r.registrationCode,
      r.status,
      r.checkedIn ? 'Yes' : 'No',
      new Date(r.createdAt).toLocaleString(),
      ...keys.map((k) => String(r.userData[k] ?? '')),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allUserDataKeys = Array.from(
    new Set(registrations.flatMap((r) => Object.keys(r.userData))),
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/admin/events/${eventId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Registrations</h1>
            <p className="text-sm text-gray-500">{meta.total} total</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/admin/events/${eventId}/checkin`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <QrCode className="w-4 h-4" />
              Check-in Scanner
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total', value: meta.total, color: 'text-blue-600' },
          { label: 'Checked In', value: registrations.filter((r) => r.checkedIn).length, color: 'text-green-600' },
          { label: 'Pending', value: registrations.filter((r) => r.status === 'pending').length, color: 'text-yellow-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchRegistrations}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : registrations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500">No registrations yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Check-in</th>
                {allUserDataKeys.slice(0, 3).map((key) => (
                  <th key={key} className="px-4 py-3 text-left font-medium text-gray-600">
                    {key}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-gray-600">Registered</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registrations.map((reg, i) => {
                const style = STATUS_STYLES[reg.status];
                const StatusIcon = style.icon;
                return (
                  <motion.tr
                    key={reg.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {reg.registrationCode}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {reg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {reg.checkedIn ? (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ {reg.checkedInAt ? new Date(reg.checkedInAt).toLocaleTimeString() : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {allUserDataKeys.slice(0, 3).map((key) => (
                      <td key={key} className="px-4 py-3 text-gray-700 max-w-32 truncate">
                        {String(reg.userData[key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(reg.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setQrPreview({ code: reg.registrationCode, token: reg.qrCodeToken })
                          }
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                        {reg.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:bg-green-50"
                              disabled={updatingId === reg.id}
                              onClick={() => updateStatus(reg.id, 'approved')}
                            >
                              {updatingId === reg.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:bg-red-50"
                              disabled={updatingId === reg.id}
                              onClick={() => updateStatus(reg.id, 'rejected')}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-600 px-2">
            {page} / {meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* QR Preview Dialog */}
      <Dialog open={!!qrPreview} onOpenChange={() => setQrPreview(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Registration QR Code</DialogTitle>
          </DialogHeader>
          {qrPreview && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="font-mono text-xs text-gray-500">{qrPreview.code}</p>
              <p className="text-xs text-gray-400 text-center">
                The QR code was sent to the registrant at sign-up. Use the check-in scanner to scan it.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
