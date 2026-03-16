'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Download,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  Search,
  Loader2,
  RefreshCw,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface CommissionRecord {
  id: string;
  amount: number | string;
  rate: number | string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  sale?: {
    salePrice: number | string;
    taxAmount?: number | string;
    property?: { title: string };
  };
  realtor?: {
    loyaltyTier: string;
    user: { firstName: string; lastName: string; email: string };
  };
}

const formatCurrency = (amount: number | string) => {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);
};

const toNumber = (v: number | string | undefined): number =>
  v === undefined ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v;

const periodLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getPeriodKey = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function RealtorPayrollPage() {
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/commissions?limit=500');
      const inner = res?.data ?? res;
      const records: CommissionRecord[] = Array.isArray(inner) ? inner : (Array.isArray(inner?.data) ? inner.data : []);
      setCommissions(records);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group by period (month)
  type PeriodGroup = {
    key: string;
    label: string;
    realtors: Map<string, {
      id: string;
      name: string;
      tier: string;
      commissions: CommissionRecord[];
      totalGross: number;
      totalTax: number;
      totalNet: number;
      pendingCount: number;
      paidCount: number;
    }>;
  };

  const periodsMap = new Map<string, PeriodGroup>();

  commissions.forEach((c) => {
    const dateStr = c.paidAt || c.createdAt;
    const key = getPeriodKey(dateStr);
    const label = periodLabel(dateStr);
    if (!periodsMap.has(key)) {
      periodsMap.set(key, { key, label, realtors: new Map() });
    }
    const period = periodsMap.get(key)!;
    const realtorId = (c.realtor as any)?.id || c.id; // use a stable key
    const realtorName = c.realtor?.user
      ? `${c.realtor.user.firstName} ${c.realtor.user.lastName}`
      : 'Unknown';
    const realtorKey = realtorName + '_' + (c.realtor?.loyaltyTier ?? '');

    if (!period.realtors.has(realtorKey)) {
      period.realtors.set(realtorKey, {
        id: realtorKey,
        name: realtorName,
        tier: c.realtor?.loyaltyTier ?? 'BRONZE',
        commissions: [],
        totalGross: 0,
        totalTax: 0,
        totalNet: 0,
        pendingCount: 0,
        paidCount: 0,
      });
    }
    const entry = period.realtors.get(realtorKey)!;
    const gross = toNumber(c.amount);
    const tax = toNumber(c.sale?.taxAmount);
    const net = gross - tax;
    entry.commissions.push(c);
    entry.totalGross += gross;
    entry.totalTax += tax;
    entry.totalNet += net;
    if (c.status === 'PAID') entry.paidCount++;
    else entry.pendingCount++;
  });

  const periods = Array.from(periodsMap.values()).sort((a, b) => b.key.localeCompare(a.key));

  const handlePayAll = async (periodKey: string) => {
    const period = periodsMap.get(periodKey);
    if (!period) return;
    const pending = Array.from(period.realtors.values())
      .flatMap((r) => r.commissions.filter((c) => c.status === 'PENDING'));
    if (pending.length === 0) { toast.info('No pending commissions for this period'); return; }

    setPayingIds((prev) => { const next = new Set(prev); next.add(periodKey); return next; });
    let success = 0;
    let failed = 0;
    for (const c of pending) {
      try {
        await api.post(`/commissions/${c.id}/pay`, {});
        success++;
      } catch { failed++; }
    }
    setPayingIds((prev) => { const next = new Set(prev); next.delete(periodKey); return next; });
    if (success > 0) toast.success(`Paid ${success} commission${success > 1 ? 's' : ''}`);
    if (failed > 0) toast.error(`${failed} payment${failed > 1 ? 's' : ''} failed`);
    fetchData();
  };

  const downloadPeriodReport = (period: PeriodGroup) => {
    const realtorRows = Array.from(period.realtors.values()).map((r) =>
      `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${r.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${r.tier}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${r.commissions.length}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${formatCurrency(r.totalGross)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626">${formatCurrency(r.totalTax)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold">${formatCurrency(r.totalNet)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${r.paidCount > 0 && r.pendingCount === 0 ? 'PAID' : r.pendingCount > 0 ? 'PENDING' : 'PARTIAL'}</td>
      </tr>`
    ).join('');
    const totalGross = Array.from(period.realtors.values()).reduce((s, r) => s + r.totalGross, 0);
    const totalTax = Array.from(period.realtors.values()).reduce((s, r) => s + r.totalTax, 0);
    const totalNet = Array.from(period.realtors.values()).reduce((s, r) => s + r.totalNet, 0);
    const fmt = (n: number) => formatCurrency(n);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Realtor Payroll - ${period.label}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:40px}h1{font-size:20px;color:#1e40af;margin-bottom:4px}.subtitle{color:#666;font-size:12px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f8fafc;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb}.summary{display:flex;gap:16px;margin:20px 0}.summary-card{flex:1;background:#f8fafc;border-radius:8px;padding:14px}.summary-card p{font-size:11px;color:#666;margin-bottom:4px}.summary-card .val{font-size:16px;font-weight:bold}@media print{body{padding:20px}}</style>
    </head><body>
    <h1>Realtor Commission Payroll</h1><div class="subtitle">${period.label} &nbsp;·&nbsp; ${period.realtors.size} realtors</div>
    <div class="summary">
      <div class="summary-card"><p>Total Gross Commissions</p><div class="val">${fmt(totalGross)}</div></div>
      <div class="summary-card"><p>Total Tax Deducted</p><div class="val" style="color:#dc2626">${fmt(totalTax)}</div></div>
      <div class="summary-card"><p>Total Net Commissions</p><div class="val" style="color:#1e40af">${fmt(totalNet)}</div></div>
    </div>
    <table><thead><tr><th>Realtor</th><th>Tier</th><th style="text-align:center">Sales</th><th style="text-align:right">Gross</th><th style="text-align:right">Tax</th><th style="text-align:right">Net</th><th style="text-align:center">Status</th></tr></thead><tbody>${realtorRows}</tbody></table>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // Overall stats
  const totalCommissions = commissions.length;
  const totalPaid = commissions.filter((c) => c.status === 'PAID').reduce((s, c) => s + toNumber(c.amount), 0);
  const totalPending = commissions.filter((c) => c.status === 'PENDING').reduce((s, c) => s + toNumber(c.amount), 0);
  const uniqueRealtors = new Set(commissions.map((c) => `${c.realtor?.user?.firstName ?? ''}${c.realtor?.user?.lastName ?? ''}`)).size;

  const filteredPeriods = searchQuery
    ? periods.map((p) => ({
        ...p,
        realtors: new Map(
          Array.from(p.realtors.entries()).filter(([, r]) =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        ),
      })).filter((p) => p.realtors.size > 0)
    : periods;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Realtor Commission Payroll</h1>
          <p className="text-muted-foreground">Manage and process realtor commission payments by period</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Paid', value: formatCurrency(totalPaid), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Pending', value: formatCurrency(totalPending), icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
          { label: 'Total Records', value: totalCommissions.toString(), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Active Realtors', value: uniqueRealtors.toString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-6">
                <div className={`p-2 rounded-lg ${stat.bg} w-fit mb-2`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search realtor..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Period breakdown */}
      {filteredPeriods.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No commissions found</p>
          </CardContent>
        </Card>
      ) : (
        filteredPeriods.map((period, pi) => {
          const realtorList = Array.from(period.realtors.values());
          const periodGross = realtorList.reduce((s, r) => s + r.totalGross, 0);
          const periodNet = realtorList.reduce((s, r) => s + r.totalNet, 0);
          const hasPending = realtorList.some((r) => r.pendingCount > 0);
          const allPaid = realtorList.every((r) => r.pendingCount === 0 && r.paidCount > 0);
          const isPaying = payingIds.has(period.key);

          return (
            <motion.div key={period.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pi * 0.05 }}>
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-primary" />
                      {period.label}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {realtorList.length} realtors &nbsp;·&nbsp; Gross: {formatCurrency(periodGross)} &nbsp;·&nbsp; Net: {formatCurrency(periodNet)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => downloadPeriodReport(period)}>
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    {hasPending && (
                      <Button size="sm" className="gap-1" onClick={() => handlePayAll(period.key)} disabled={isPaying}>
                        {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                        Pay All Pending
                      </Button>
                    )}
                    {allPaid && (
                      <Badge className="bg-green-100 text-green-700">All Paid</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Realtor</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead className="text-center">Sales</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {realtorList.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="bg-primary text-white text-xs">
                                    {r.name[0] || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">{r.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{r.tier}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{r.commissions.length}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.totalGross)}</TableCell>
                            <TableCell className="text-right text-red-600">-{formatCurrency(r.totalTax)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(r.totalNet)}</TableCell>
                            <TableCell className="text-center">
                              {r.pendingCount === 0 && r.paidCount > 0 ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>
                              ) : r.paidCount > 0 && r.pendingCount > 0 ? (
                                <Badge className="bg-yellow-100 text-yellow-700 text-xs">Partial</Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
