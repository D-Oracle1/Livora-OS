'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Search, Loader2, RefreshCw, Trash2, Eye, TrendingUp,
  XCircle, CheckCircle, Clock, Banknote, ChevronLeft, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface Sale {
  id: string;
  property: string;
  propertyAddress: string;
  buyer: string;
  buyerEmail: string;
  buyerPhone: string;
  realtor: string;
  amount: number;
  contractValue: number;
  totalPaid: number;
  remainingBalance: number;
  commission: number;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  numberOfInstallments: number;
  paymentsMade: number;
  status: string;
  date: string;
  notes: string;
}

const STATUS_BADGE: Record<string, React.ReactElement> = {
  PENDING:     <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">Pending</Badge>,
  IN_PROGRESS: <Badge className="bg-blue-100 text-blue-700 text-[10px]">In Progress</Badge>,
  COMPLETED:   <Badge className="bg-green-100 text-green-700 text-[10px]">Completed</Badge>,
  CANCELLED:   <Badge className="bg-red-100 text-red-700 text-[10px]">Cancelled</Badge>,
};

export default function SuperAdminSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collectedRevenue, setCollectedRevenue] = useState<number | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/sales?page=1&limit=500');
      const wrapped = res?.data || res;
      const items: any[] = Array.isArray(wrapped) ? wrapped : (wrapped?.data || []);
      setSales(items.map((s: any) => {
        const contractValue = Number(s.salePrice) || (Number(s.totalPaid) + Number(s.remainingBalance)) || 0;
        const ni = s.numberOfInstallments || 1;
        const fromArray = s.payments?.length || 0;
        const paymentsMade = fromArray > 0
          ? fromArray
          : contractValue > 0 ? Math.round(Number(s.totalPaid) / (contractValue / ni)) : 0;
        return {
          id: s.id,
          property: s.property?.title || 'Unknown Property',
          propertyAddress: s.property?.address || s.property?.city || '',
          buyer: `${s.client?.user?.firstName || ''} ${s.client?.user?.lastName || ''}`.trim() || 'Unknown',
          buyerEmail: s.client?.user?.email || '',
          buyerPhone: s.client?.user?.phone || '',
          realtor: s.realtorId
            ? (`${s.realtor?.user?.firstName || ''} ${s.realtor?.user?.lastName || ''}`.trim() || 'Unknown')
            : 'Company',
          contractValue,
          amount: s.paymentPlan === 'INSTALLMENT' ? Number(s.totalPaid) || 0 : Number(s.salePrice) || 0,
          totalPaid: Number(s.totalPaid) || 0,
          remainingBalance: Number(s.remainingBalance) || 0,
          commission: Number(s.commissionAmount) || 0,
          paymentPlan: s.paymentPlan || 'FULL',
          numberOfInstallments: ni,
          paymentsMade,
          status: s.status || 'PENDING',
          date: s.saleDate ? new Date(s.saleDate).toISOString().split('T')[0] : '',
          notes: s.notes || '',
        };
      }));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCollectedRevenue = useCallback(async () => {
    try {
      const res: any = await api.get('/admin/dashboard');
      const data = res?.data || res;
      setCollectedRevenue(Number(data?.revenue?.allTime ?? data?.allTimeRevenue ?? 0));
    } catch {
      // non-critical — leave as null
    }
  }, []);

  useEffect(() => { fetchSales(); fetchCollectedRevenue(); }, [fetchSales, fetchCollectedRevenue]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/sales/${id}`);
      toast.success('Sale deleted permanently');
      setConfirmDeleteId(null);
      setSelected(null);
      fetchSales();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete sale');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.property.toLowerCase().includes(q) ||
      s.buyer.toLowerCase().includes(q) ||
      s.realtor.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalContracts = sales.reduce((sum, s) => sum + s.contractValue, 0);
  const pending = sales.filter(s => s.status === 'PENDING').length;
  const completed = sales.filter(s => s.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm">All sales across the platform</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSales} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(totalRevenue), sub: 'All payments collected', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Contract Value', value: formatCurrency(totalContracts), sub: 'Total contracted amounts', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          {
            label: 'Collected Revenue',
            value: collectedRevenue === null ? '...' : formatCurrency(collectedRevenue),
            sub: 'Matches dashboard & accounting',
            icon: DollarSign,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
          },
          { label: 'Pending', value: String(pending), sub: 'Awaiting approval', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Completed', value: String(completed), sub: 'Fully paid', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/70 truncate">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">All Sales ({filtered.length})</CardTitle>
            <div className="relative flex-1 max-w-sm ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search property, buyer, realtor..."
                className="pl-9 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{search ? 'No sales match your search' : 'No sales recorded yet'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium">Property / Buyer</th>
                    <th className="text-left px-4 py-2 font-medium">Realtor</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                    <th className="text-center px-4 py-2 font-medium">Plan</th>
                    <th className="text-center px-4 py-2 font-medium">Date</th>
                    <th className="text-center px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sale => (
                    <tr key={sale.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]">{sale.property}</p>
                        <p className="text-xs text-muted-foreground">{sale.buyer}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.realtor}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(sale.amount)}
                        {sale.paymentPlan === 'INSTALLMENT' && sale.remainingBalance > 0 && (
                          <p className="text-[10px] text-muted-foreground font-normal">
                            bal: {formatCurrency(sale.remainingBalance)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sale.paymentPlan === 'INSTALLMENT' ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <Badge className="text-[10px] bg-orange-100 text-orange-700">
                              {sale.remainingBalance <= 0
                                ? 'Fully Paid'
                                : `${sale.paymentsMade}/${Math.max(sale.numberOfInstallments, sale.paymentsMade)} paid`}
                            </Badge>
                            <div className="w-14 h-1 bg-gray-200 rounded-full">
                              <div
                                className="h-full bg-orange-400 rounded-full"
                                style={{ width: `${sale.contractValue > 0 ? Math.min((sale.totalPaid / sale.contractValue) * 100, 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Full</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {sale.date ? formatDate(sale.date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {STATUS_BADGE[sale.status] || <Badge variant="secondary">{sale.status}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setSelected(sale)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setConfirmDeleteId(sale.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* Detail Dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected.property}</DialogTitle>
              <DialogDescription>{selected.propertyAddress}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Buyer</p><p className="font-medium">{selected.buyer}</p></div>
                <div><p className="text-xs text-muted-foreground">Realtor</p><p className="font-medium">{selected.realtor}</p></div>
                <div><p className="text-xs text-muted-foreground">Contract Value</p><p className="font-medium">{formatCurrency(selected.contractValue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Paid</p><p className="font-medium text-green-600">{formatCurrency(selected.totalPaid)}</p></div>
                <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-medium text-red-600">{formatCurrency(selected.remainingBalance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Commission</p><p className="font-medium">{formatCurrency(selected.commission)}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{selected.date ? formatDate(selected.date) : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p>{STATUS_BADGE[selected.status] || <Badge>{selected.status}</Badge>}</div>
              </div>
              {selected.notes && (
                <div className="p-3 bg-muted/40 rounded-lg text-xs">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p>{selected.notes}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              <Button
                variant="destructive"
                onClick={() => { setSelected(null); setConfirmDeleteId(selected.id); }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Sale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Delete Sale Permanently
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the sale record and all associated payments,
              commissions, and tax records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Yes, Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
