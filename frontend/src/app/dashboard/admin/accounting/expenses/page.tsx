'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Pencil, Trash2, Check, X, ChevronDown, Loader2, Upload, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getToken } from '@/lib/auth-storage';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'];
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const emptyForm = {
  title: '',
  description: '',
  categoryId: '',
  amount: '',
  paymentMethod: 'CASH',
  expenseDate: new Date().toISOString().split('T')[0],
  referenceNumber: '',
  receiptUrl: '',
  departmentId: '',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dialog state
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; expense?: any }>({ open: false, mode: 'create' });
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [rejectReason, setRejectReason] = useState('');

  // Audit log dialog
  const [auditDialog, setAuditDialog] = useState<{ open: boolean; expense: any | null }>({ open: false, expense: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (filterStatus !== 'ALL') params.set('approvalStatus', filterStatus);
      if (filterCategory !== 'ALL') params.set('categoryId', filterCategory);

      const [expRaw, catRaw, statRaw] = await Promise.all([
        api.get<any>(`/expenses?${params}`),
        api.get<any>('/expense-categories'),
        api.get<any>('/expenses/stats'),
      ]);

      const expData = expRaw?.data ?? expRaw;
      setExpenses(Array.isArray(expData?.data) ? expData.data : []);
      setTotalPages(expData?.meta?.totalPages ?? 1);
      setCategories(Array.isArray(catRaw?.data ?? catRaw) ? (catRaw?.data ?? catRaw) : []);
      setStats(statRaw?.data ?? statRaw);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setForm({ ...emptyForm }); setDialog({ open: true, mode: 'create' }); };
  const openEdit = (exp: any) => {
    setForm({
      title: exp.title,
      description: exp.description ?? '',
      categoryId: exp.categoryId,
      amount: String(Number(exp.amount)),
      paymentMethod: exp.paymentMethod,
      expenseDate: new Date(exp.expenseDate).toISOString().split('T')[0],
      referenceNumber: exp.referenceNumber ?? '',
      receiptUrl: exp.receiptUrl ?? '',
      departmentId: exp.departmentId ?? '',
    });
    setDialog({ open: true, mode: 'edit', expense: exp });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.categoryId) return toast.error('Category is required');
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) return toast.error('Valid amount is required');
    if (!form.expenseDate) return toast.error('Expense date is required');

    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
      };
      if (dialog.mode === 'create') {
        await api.post('/expenses', payload);
        toast.success('Expense added — pending approval');
      } else {
        await api.patch(`/expenses/${dialog.expense.id}`, payload);
        toast.success('Expense updated');
      }
      setDialog({ open: false, mode: 'create' });
      fetchData();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/expenses/${id}/approve`, {});
      toast.success('Expense approved');
      fetchData();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await api.patch(`/expenses/${rejectDialog.id}/reject`, { reason: rejectReason || 'No reason provided' });
      toast.success('Expense rejected');
      setRejectDialog({ open: false, id: '' });
      setRejectReason('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to reject');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense? This action cannot be undone.')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Expense deleted');
      fetchData();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete');
    }
  };

  const handleReceiptUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/upload/file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      const url = result?.data?.url || result?.url || '';
      setForm((f) => ({ ...f, receiptUrl: url }));
      toast.success('Receipt uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openAuditLog = async (exp: any) => {
    try {
      const raw = await api.get<any>(`/expenses/${exp.id}`);
      setAuditDialog({ open: true, expense: raw?.data ?? raw });
    } catch {
      toast.error('Failed to load audit log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage company expenses</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Approved Expenses', value: formatCurrency(stats.approved?.total ?? 0), count: stats.approved?.count ?? 0, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Pending Review', value: formatCurrency(stats.pending?.total ?? 0), count: stats.pending?.count ?? 0, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Rejected', value: formatCurrency(stats.rejected?.total ?? 0), count: stats.rejected?.count ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.count} expense(s)</p>
                </div>
                <div className={`text-2xl font-bold ${s.color} ${s.bg} rounded-full w-10 h-10 flex items-center justify-center`}>
                  {s.count}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No expenses found. Add your first expense.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Method</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Added By</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{exp.title}</p>
                        {exp.referenceNumber && <p className="text-xs text-gray-400">Ref: {exp.referenceNumber}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{exp.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(Number(exp.amount))}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(exp.expenseDate)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{exp.paymentMethod.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs font-medium ${STATUS_COLORS[exp.approvalStatus]}`}>
                          {exp.approvalStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {exp.createdBy ? `${exp.createdBy.firstName} ${exp.createdBy.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {exp.approvalStatus === 'PENDING' && (
                            <>
                              <button title="Approve" onClick={() => handleApprove(exp.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                <Check className="w-4 h-4" />
                              </button>
                              <button title="Reject" onClick={() => { setRejectDialog({ open: true, id: exp.id }); setRejectReason(''); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button title="Edit" onClick={() => openEdit(exp)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" disabled={exp.approvalStatus === 'APPROVED'}>
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button title="Audit Log" onClick={() => openAuditLog(exp)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button title="Delete" onClick={() => handleDelete(exp.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog.open} onOpenChange={(v) => !v && setDialog({ open: false, mode: 'create' })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.mode === 'create' ? 'Add Expense' : 'Edit Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Title *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Office Supplies" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Category *</label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount (₦) *</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Expense Date *</label>
                <Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Payment Method</label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Reference Number</label>
              <Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Receipt</label>
              {form.receiptUrl ? (
                <div className="flex items-center gap-2">
                  <a href={form.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline truncate max-w-xs">View receipt</a>
                  <button className="text-xs text-red-500 underline" onClick={() => setForm({ ...form, receiptUrl: '' })}>Remove</button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])} />
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : 'Upload Receipt'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, mode: 'create' })}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : dialog.mode === 'create' ? 'Add Expense' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(v) => !v && setRejectDialog({ open: false, id: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Expense</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700 block mb-1">Reason (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: '' })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={auditDialog.open} onOpenChange={(v) => !v && setAuditDialog({ open: false, expense: null })}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Audit Log — {auditDialog.expense?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {(auditDialog.expense?.auditLogs ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No audit log entries</p>
            ) : (
              (auditDialog.expense?.auditLogs ?? []).map((log: any) => (
                <div key={log.id} className="flex gap-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                        log.action === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        log.action === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        log.action === 'DELETED' ? 'bg-gray-100 text-gray-600' :
                        'bg-blue-100 text-blue-700'
                      }`}>{log.action}</span>
                      by {log.user?.firstName} {log.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(log.createdAt)}</p>
                    {log.newValues && Object.keys(log.newValues).length > 0 && (
                      <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded p-2">
                        {Object.entries(log.newValues).map(([k, v]) => (
                          <p key={k}><span className="font-medium">{k}:</span> {String(v)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
