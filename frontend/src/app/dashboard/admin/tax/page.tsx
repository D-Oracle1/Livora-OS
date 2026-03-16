'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Download,
  Percent,
  Hash,
  CalendarDays,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency, getTierBgClass } from '@/lib/utils';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';
import { NairaSign } from '@/components/icons/naira-sign';

type TimePeriod = 'quarter' | 'year' | 'all';

export default function TaxPage() {
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [searchTerm, setSearchTerm] = useState('');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxRateLoaded, setTaxRateLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [taxRecords, setTaxRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch tax rate (incomeTax) — this is what's applied to commissions
  const fetchTaxRate = useCallback(async () => {
    try {
      const response: any = await api.get('/settings/tax-rates');
      const data = response?.data ?? response;
      if (data?.incomeTax != null) {
        setTaxRate(Math.round(data.incomeTax * 100 * 100) / 100);
      }
    } catch {
      // Keep default
    } finally {
      setTaxRateLoaded(true);
    }
  }, []);

  // Fetch all tax records (paginated — fetch first page then remaining)
  const fetchTaxRecords = useCallback(async () => {
    setLoading(true);
    try {
      // api.get returns raw JSON — backend shape: { data: [...], meta: { totalPages, ... } }
      const firstPage: any = await api.get('/taxes?page=1&limit=50');
      const meta = firstPage?.meta ?? {};
      const totalPages: number = meta?.totalPages ?? 1;
      let rawRecords: any[] = Array.isArray(firstPage?.data) ? firstPage.data : [];

      // Fetch remaining pages if any
      for (let p = 2; p <= totalPages; p++) {
        const page: any = await api.get(`/taxes?page=${p}&limit=50`);
        const pageRecords: any[] = Array.isArray(page?.data) ? page.data : [];
        rawRecords = rawRecords.concat(pageRecords);
      }

      const mapped = rawRecords.map((item: any) => {
        const realtorUser = item.realtor?.user;
        const realtorName = realtorUser
          ? `${realtorUser.firstName ?? ''} ${realtorUser.lastName ?? ''}`.trim()
          : 'Unknown';
        const grossCommission = Number(item.sale?.commissionAmount ?? 0);
        const taxAmount = Number(item.amount ?? 0);
        const netEarnings = grossCommission - taxAmount;
        const recordTaxRate = Number(item.rate ?? 0) * 100;

        return {
          id: item.id,
          realtor: realtorName,
          tier: item.realtor?.loyaltyTier ?? 'BRONZE',
          email: realtorUser?.email ?? '',
          grossCommission,
          taxAmount,
          netEarnings,
          taxRate: recordTaxRate,
          year: item.year ?? new Date().getFullYear(),
          quarter: item.quarter ?? 1,
          sale: item.sale?.property?.title ?? 'N/A',
          saleAmount: Number(item.sale?.salePrice ?? 0),
        };
      });

      setTaxRecords(mapped);
    } catch {
      // API unavailable — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  const syncRecords = useCallback(async (silent = false) => {
    setSyncing(true);
    try {
      const res: any = await api.post('/taxes/recalculate');
      const result = res?.data ?? res;
      if (!silent) toast.success(`Synced — ${result.created ?? 0} created, ${result.updated ?? 0} updated`);
    } catch {
      if (!silent) toast.error('Sync failed');
    } finally {
      setSyncing(false);
      await fetchTaxRecords();
    }
  }, [fetchTaxRecords]);

  useEffect(() => {
    fetchTaxRate();
    // Auto-sync on mount to populate records for existing approved sales
    syncRecords(true);
  }, [fetchTaxRate, syncRecords]);

  // Auto-save tax rate (debounced 600ms) — updates incomeTax which drives commission deductions,
  // then recalculates all existing tax records so they reflect the new rate immediately.
  const handleRateChange = (value: number) => {
    setTaxRate(value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await api.put('/settings/tax-rates', { incomeTax: value / 100 });
        await api.post('/taxes/recalculate');
        await fetchTaxRecords();
        toast.success('Tax rate updated and all records recalculated');
      } catch {
        toast.error('Failed to update tax rate');
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  // Filter by time period
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    return taxRecords.filter(r => {
      switch (timePeriod) {
        case 'quarter': return r.quarter === currentQuarter && r.year === currentYear;
        case 'year':    return r.year === currentYear;
        default:        return true;
      }
    });
  }, [timePeriod, taxRecords]);

  const filteredReports = filteredByTime.filter(r =>
    r.realtor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const totalTax = filteredByTime.reduce((acc, r) => acc + (r.taxAmount || 0), 0);
    const thisYearTax = taxRecords
      .filter(r => r.year === new Date().getFullYear())
      .reduce((acc, r) => acc + (r.taxAmount || 0), 0);

    return [
      { title: 'Total Tax Collected', value: formatCurrency(totalTax),                 icon: NairaSign,  color: 'text-primary',    bgColor: 'bg-primary/10' },
      { title: 'Tax Rate',            value: taxRateLoaded ? `${taxRate}%` : '…',       icon: Percent,     color: 'text-blue-600',   bgColor: 'bg-blue-100' },
      { title: 'Total Records',       value: filteredByTime.length.toString(),          icon: Hash,        color: 'text-green-600',  bgColor: 'bg-green-100' },
      { title: 'This Year',           value: formatCurrency(thisYearTax),               icon: CalendarDays, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    ];
  }, [filteredByTime, taxRecords, taxRate, taxRateLoaded]);

  const generateTaxStatement = (report: typeof taxRecords[0]) => {
    const receipt: ReceiptData = {
      type: 'tax',
      receiptNumber: `TAX-${report.year}-Q${report.quarter}-${report.id?.toString().padStart(4, '0')}`,
      date: `${report.year}-${String((report.quarter - 1) * 3 + 1).padStart(2, '0')}-01`,
      seller: {
        name: companyName + ' — Tax Division',
        email: branding.supportEmail || '',
        phone: branding.supportPhone || '',
        address: branding.address || '',
      },
      buyer: {
        name: report.realtor,
        email: report.email,
      },
      items: [
        { description: 'Gross Commission Earnings', amount: report.grossCommission },
        { description: `Tax Deduction (${report.taxRate}%)`, amount: -report.taxAmount },
      ],
      subtotal: report.grossCommission,
      fees: [{ label: `Tax (${report.taxRate}%)`, amount: report.taxAmount }],
      total: report.netEarnings,
      status: 'completed',
      notes: `Tax Year: ${report.year} | Q${report.quarter} | Official tax deduction statement.`,
    };
    setReceiptData(receipt);
    setShowReceipt(true);
  };

  const handleExportAll = () => {
    const csvContent = [
      ['Realtor', 'Tier', 'Property', 'Gross Commission', 'Tax Rate', 'Tax Amount', 'Net Earnings', 'Year', 'Quarter'].join(','),
      ...filteredReports.map(r =>
        [r.realtor, r.tier, r.sale, r.grossCommission, `${r.taxRate}%`, r.taxAmount, r.netEarnings, r.year, `Q${r.quarter}`].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax-records-${timePeriod}.csv`;
    link.click();
    toast.success('Tax records exported');
  };

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'quarter': return 'This Quarter';
      case 'year':    return 'This Year';
      default:        return 'All Time';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <h1 className="text-2xl font-bold">Tax Management</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => syncRecords(false)} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync Records
          </Button>
          {(['quarter', 'year', 'all'] as TimePeriod[]).map(p => (
            <Button
              key={p}
              variant={timePeriod === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(p)}
            >
              {p === 'quarter' ? 'This Quarter' : p === 'year' ? 'This Year' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${stat.bgColor} mb-4`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tax Rate Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" />
                Tax Rate on Commission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Income Tax Rate</span>
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxRateLoaded ? taxRate : ''}
                    disabled={!taxRateLoaded}
                    onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                    className="w-28 text-2xl font-bold text-primary h-12"
                  />
                  <span className="text-2xl font-bold text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Applied to realtor commissions. Changes save automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tax Records */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Tax Records — {getPeriodLabel()}
              </CardTitle>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search realtors..."
                    className="pl-9 w-full sm:w-40"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={handleExportAll} disabled={filteredReports.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground border-b">
                        <th className="pb-4 font-medium">Realtor</th>
                        <th className="pb-4 font-medium">Property</th>
                        <th className="pb-4 font-medium text-right">Gross Commission</th>
                        <th className="pb-4 font-medium text-center">Rate</th>
                        <th className="pb-4 font-medium text-right">Tax Amount</th>
                        <th className="pb-4 font-medium text-right">Net Earnings</th>
                        <th className="pb-4 font-medium text-center">Period</th>
                        <th className="pb-4 font-medium text-center">Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8 shrink-0">
                                <AvatarFallback className="bg-primary text-white text-xs">
                                  {report.realtor?.split(' ').map((n: string) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{report.realtor}</p>
                                <Badge className={`${getTierBgClass(report.tier)} text-xs`}>{report.tier}</Badge>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-sm text-gray-600 max-w-[120px] truncate">{report.sale}</td>
                          <td className="py-4 font-medium text-right">{formatCurrency(report.grossCommission)}</td>
                          <td className="py-4 text-center text-sm">{report.taxRate}%</td>
                          <td className="py-4 text-red-600 font-medium text-right">-{formatCurrency(report.taxAmount)}</td>
                          <td className="py-4 text-primary font-semibold text-right">{formatCurrency(report.netEarnings)}</td>
                          <td className="py-4 text-center text-xs text-gray-500">{report.year} Q{report.quarter}</td>
                          <td className="py-4 text-center">
                            <Button variant="ghost" size="sm" onClick={() => generateTaxStatement(report)}>
                              <FileText className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredReports.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No tax records found for the selected period.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <ReceiptModal
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        data={receiptData}
        branding={branding}
      />
    </div>
  );
}
