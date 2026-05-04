'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, MapPin, Phone, Mail, Users, Home,
  BarChart3, Pencil, Trash2, Loader2, RefreshCw, CheckCircle,
  XCircle, ArrowRightLeft, TrendingUp, DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

const emptyForm = {
  name: '', code: '', description: '', address: '', city: '', state: '',
  country: 'Nigeria', latitude: '', longitude: '', phone: '', email: '', managerId: '',
};

export default function AdminBranchesPage() {
  const [branches, setBranches]     = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [transfers, setTransfers]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [formOpen, setFormOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [target, setTarget]         = useState<any>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const now   = new Date();
      const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const end   = now.toISOString().slice(0, 10);
      const [branchRes, compRes, transferRes] = await Promise.all([
        api.get('/branches'),
        api.get(`/accounting/branches/comparison?startDate=${start}&endDate=${end}`),
        api.get('/branches/transfers/list?status=PENDING'),
      ]);
      const b = branchRes?.data ?? branchRes;
      setBranches(Array.isArray(b) ? b : []);
      setComparison(compRes?.data ?? compRes);
      const t = transferRes?.data ?? transferRes;
      setTransfers(Array.isArray(t) ? t : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load branch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit   = (b: any) => {
    setEditing(b);
    setForm({
      name: b.name, code: b.code, description: b.description ?? '',
      address: b.address, city: b.city, state: b.state,
      country: b.country ?? 'Nigeria', latitude: String(b.latitude ?? ''),
      longitude: String(b.longitude ?? ''), phone: b.phone ?? '', email: b.email ?? '',
      managerId: b.managerId ?? '',
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.code || !form.address || !form.city || !form.state) {
      return toast.error('Name, code, address, city and state are required');
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        latitude:  form.latitude  ? parseFloat(form.latitude)  : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        managerId: form.managerId || undefined,
      };
      if (editing) {
        await api.put(`/branches/${editing.id}`, payload);
        toast.success('Branch updated');
      } else {
        await api.post('/branches', payload);
        toast.success('Branch created');
      }
      setFormOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save branch');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBranch = async () => {
    if (!target) return;
    try {
      await api.delete(`/branches/${target.id}`);
      toast.success('Branch deleted');
      setDeleteOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Cannot delete branch');
    }
  };

  const approveTransfer = async (id: string) => {
    try {
      await api.patch(`/branches/transfers/${id}/approve`, {});
      toast.success('Transfer approved');
      load();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const rejectTransfer = async (id: string) => {
    try {
      await api.patch(`/branches/transfers/${id}/reject`, {});
      toast.success('Transfer rejected');
      load();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const filtered = branches.filter(b =>
    !search ||
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.code?.toLowerCase().includes(search.toLowerCase()) ||
    b.city?.toLowerCase().includes(search.toLowerCase())
  );

  const compChartData = comparison?.branches?.map((b: any) => ({
    name: b.branchCode,
    Revenue:   b.revenue,
    Expenses:  b.expenses,
    NetProfit: b.netProfit,
  })) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branch Management</h1>
          <Badge variant="secondary">{branches.length}</Badge>
          {transfers.length > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700">{transfers.length} pending transfer{transfers.length > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm" disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />New Branch
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branches">
        <TabsList>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="comparison">Revenue Comparison</TabsTrigger>
          <TabsTrigger value="transfers">
            Transfers
            {transfers.length > 0 && <Badge className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5">{transfers.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Branches Tab ─────────────────────────────────────── */}
        <TabsContent value="branches" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, city..." className="pl-9" />
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">No branches yet. Create your first branch.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((b) => (
                <Card key={b.id} className={`hover:shadow-md transition-shadow ${!b.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{b.name}</h3>
                          <Badge variant="outline" className="font-mono text-xs">{b.code}</Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />{b.city}, {b.state}
                        </div>
                      </div>
                      {b.isActive
                        ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    </div>

                    {b.manager && (
                      <div className="text-xs text-gray-500">
                        Manager: <span className="font-medium text-gray-700 dark:text-gray-300">{b.manager.firstName} {b.manager.lastName}</span>
                      </div>
                    )}

                    <div className="flex gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b._count?.users ?? 0} staff</span>
                      <span className="flex items-center gap-1"><Home className="w-3 h-3" />{b._count?.properties ?? 0} props</span>
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{b._count?.sales ?? 0} sales</span>
                    </div>

                    {(b.phone || b.email) && (
                      <div className="flex gap-3 text-xs text-gray-400">
                        {b.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</span>}
                        {b.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{b.email}</span>}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" asChild>
                        <Link href={`/dashboard/admin/branches/${b.id}`}><BarChart3 className="w-3.5 h-3.5" />Stats</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs px-2.5" onClick={() => openEdit(b)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs px-2.5 text-red-500 hover:text-red-600 hover:border-red-300"
                        onClick={() => { setTarget(b); setDeleteOpen(true); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Revenue Comparison Tab ────────────────────────────── */}
        <TabsContent value="comparison" className="mt-4 space-y-4">
          {comparison && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Revenue',  value: fmt(comparison.consolidated?.totalRevenue ?? 0),  color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950' },
                  { label: 'Total Expenses', value: fmt(comparison.consolidated?.totalExpenses ?? 0), color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950' },
                  { label: 'Total Profit',   value: fmt(comparison.consolidated?.totalProfit ?? 0),   color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
                ].map(({ label, value, color, bg }) => (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Branch Revenue vs Expenses (YTD)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={compChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="Revenue"   fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Expenses"  fill="#ef4444" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="NetProfit" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Branch Leaderboard</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-xs text-gray-500">
                      <th className="text-left py-2 pr-4 font-medium">Branch</th>
                      <th className="text-right py-2 px-3 font-medium">Sales</th>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Expenses</th>
                      <th className="text-right py-2 pl-3 font-medium">Net Profit</th>
                    </tr></thead>
                    <tbody>
                      {comparison.branches?.map((b: any, i: number) => (
                        <tr key={b.branchId} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">{b.branchName}</div>
                                <div className="text-xs text-gray-400">{b.branchCode} · {b.city}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-3">{b.totalSales}</td>
                          <td className="text-right px-3 text-green-600 font-medium">{fmt(b.revenue)}</td>
                          <td className="text-right px-3 text-red-500">{fmt(b.expenses)}</td>
                          <td className="text-right pl-3 font-bold" style={{ color: b.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                            {fmt(b.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Transfers Tab ─────────────────────────────────────── */}
        <TabsContent value="transfers" className="mt-4 space-y-3">
          {transfers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">No pending property transfers.</CardContent></Card>
          ) : transfers.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{t.property?.title}</span>
                    <Badge variant="outline" className="text-xs">{t.property?.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">{t.fromBranch?.name} ({t.fromBranch?.code})</span>
                    <ArrowRightLeft className="w-3 h-3 text-primary" />
                    <span className="font-medium text-gray-600 dark:text-gray-300">{t.toBranch?.name} ({t.toBranch?.code})</span>
                  </div>
                  {t.reason && <p className="text-xs text-gray-400 italic">"{t.reason}"</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="gap-1 text-xs bg-green-600 hover:bg-green-700" onClick={() => approveTransfer(t.id)}>
                    <CheckCircle className="w-3.5 h-3.5" />Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs text-red-500 hover:text-red-600" onClick={() => rejectTransfer(t.id)}>
                    <XCircle className="w-3.5 h-3.5" />Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Branch Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Lagos Island" />
              </div>
              <div className="space-y-1.5">
                <Label>Branch Code * (e.g. LGS-01)</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="LGS-01" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address *</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Marina Road" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Lagos" />
              </div>
              <div className="space-y-1.5">
                <Label>State *</Label>
                <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Lagos State" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="6.4541" />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="3.3947" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Manager User ID</Label>
              <Input value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))} placeholder="UUID of branch manager user" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional branch description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Save Changes' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{target?.name}</strong>. Branches with active staff or properties cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={deleteBranch}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
