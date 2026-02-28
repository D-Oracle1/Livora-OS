'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Download,
  DollarSign,
  Percent,
  CheckCircle,
  Clock,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency, formatDate, getTierBgClass } from '@/lib/utils';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

export default function TaxPage() {
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [searchTerm, setSearchTerm] = useState('');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [vatRate, setVatRate] = useState<number>(7.5);
  const [isSaving, setIsSaving] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [taxRecords, setTaxRecords] = useState<any[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch VAT rate from API on mount
  const fetchTaxRates = useCallback(async () => {
    try {
      const response: any = await api.get('/settings/tax-rates');
      const data = response?.data ?? response;
      if (data?.vat != null) {
        setVatRate(Math.round(data.vat * 100 * 100) / 100);
      }
    } catch {
      // Keep default
    }
  }, []);

  // Fetch tax records from API on mount
  const fetchTaxRecords = useCallback(async () => {
    try {
      const response: any = await api.get('/taxes?limit=100');
      // api.get returns TransformInterceptor wrapper { success, data: { data: [...], meta }, timestamp }
      const outer = response?.data ?? response;
      const rawRecords: any[] = Array.isArray(outer) ? outer : (Array.isArray(outer?.data) ? outer.data : []);

      // Map raw Tax model records to the shape the page expects.
      // Tax model fields: id, amount (Decimal), rate (Float), year, quarter
      // Joined: sale.commissionAmount, sale.salePrice, sale.property.title
      // Joined: realtor.loyaltyTier, realtor.user.firstName/lastName
      const mapped = rawRecords.map((item: any) => {
        const realtorUser = item.realtor?.user;
        const realtorName = realtorUser
          ? `${realtorUser.firstName ?? ''} ${realtorUser.lastName ?? ''}`.trim()
          : 'Unknown';
        const grossCommission = Number(item.sale?.commissionAmount ?? 0);
        const taxAmount = Number(item.amount ?? 0);
        const netEarnings = grossCommission - taxAmount;
        const taxRate = Number(item.rate ?? 0) * 100; // convert decimal to percentage

        return {
          id: item.id,
          realtor: realtorName,
          tier: item.realtor?.loyaltyTier ?? 'BRONZE',
          email: realtorUser?.email ?? '',
          grossCommission,
          taxAmount,
          netEarnings,
          taxRate,
          year: item.year ?? new Date().getFullYear(),
          quarter: item.quarter ?? 1,
          // Derive month as the first month of the quarter (0-indexed) for time filtering
          month: ((item.quarter ?? 1) - 1) * 3,
          status: 'FILED',
          sale: item.sale?.property?.title ?? 'N/A',
          saleAmount: Number(item.sale?.salePrice ?? 0),
        };
      });

      setTaxRecords(mapped);
    } catch {
      // API unavailable, show empty state
    }
  }, []);

  useEffect(() => {
    fetchTaxRates();
    fetchTaxRecords();
  }, [fetchTaxRates, fetchTaxRecords]);

  // Auto-save VAT rate when it changes (debounced 600ms)
  const handleVatChange = (value: number) => {
    setVatRate(value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await api.put('/settings/tax-rates', { vat: value / 100, incomeTax: value / 100 });
        toast.success('VAT rate updated');
      } catch {
        toast.error('Failed to update VAT rate');
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  // Filter by time period — tax records are stored by year + quarter, not by month
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4

    return taxRecords.filter(report => {
      switch (timePeriod) {
        case 'month':
          // Tax is quarterly; "This Month" shows the current quarter's taxes
          return report.quarter === currentQuarter && report.year === currentYear;
        case 'quarter':
          return report.quarter === currentQuarter && report.year === currentYear;
        case 'year':
          return report.year === currentYear;
        case 'all':
        default:
          return true;
      }
    });
  }, [timePeriod, taxRecords]);

  const filteredReports = filteredByTime.filter(report =>
    report.realtor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const totalTax = filteredByTime.reduce((acc, r) => acc + (r.taxAmount || 0), 0);
    const filedCount = filteredByTime.filter(r => r.status === 'FILED').length;
    const pendingCount = filteredByTime.filter(r => r.status === 'PENDING').length;

    return [
      { title: 'Total Tax Collected', value: formatCurrency(totalTax), icon: DollarSign, color: 'text-primary', bgColor: 'bg-primary/10' },
      { title: 'VAT Rate', value: `${vatRate}%`, icon: Percent, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { title: 'Reports Filed', value: filedCount.toString(), icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'Pending Reports', value: pendingCount.toString(), icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    ];
  }, [filteredByTime, vatRate]);

  const generateTaxStatement = (report: typeof taxRecords[0]) => {
    const receipt: ReceiptData = {
      type: 'tax',
      receiptNumber: `TAX-${report.year}-${report.id?.toString().padStart(6, '0')}`,
      date: `${report.year}-${((report.month || 0) + 1).toString().padStart(2, '0')}-01`,
      seller: {
        name: companyName + ' - Tax Division',
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
        { description: `VAT Deduction (${report.taxRate}%)`, amount: -report.taxAmount },
      ],
      subtotal: report.grossCommission,
      fees: [{ label: `VAT (${report.taxRate}%)`, amount: report.taxAmount }],
      total: report.netEarnings,
      status: report.status === 'FILED' ? 'completed' : 'pending',
      notes: `Tax Year: ${report.year} | Official VAT deduction statement.`,
    };
    setReceiptData(receipt);
    setShowReceipt(true);
  };

  const handleExportAll = () => {
    const csvContent = [
      ['Realtor', 'Tier', 'Gross Commission', 'VAT Rate', 'Tax Amount', 'Net Earnings', 'Status'].join(','),
      ...filteredReports.map(r =>
        [r.realtor, r.tier, r.grossCommission, `${r.taxRate}%`, r.taxAmount, r.netEarnings, r.status].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax-reports-${timePeriod}.csv`;
    link.click();
    toast.success('Tax reports exported successfully!');
  };

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      case 'all': return 'All Time';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Filter */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <h1 className="text-2xl font-bold">Tax Management</h1>
        <div className="flex flex-wrap gap-2">
          {(['month', 'quarter', 'year', 'all'] as TimePeriod[]).map(p => (
            <Button
              key={p}
              variant={timePeriod === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(p)}
            >
              {p === 'month' && <Calendar className="w-4 h-4 mr-2" />}
              {p === 'month' ? 'This Month' : p === 'quarter' ? 'Quarter' : p === 'year' ? 'This Year' : 'All Time'}
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
        {/* VAT Rate Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" />
                VAT Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Value Added Tax (VAT)</span>
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vatRate}
                    onChange={(e) => handleVatChange(parseFloat(e.target.value) || 0)}
                    className="w-28 text-2xl font-bold text-primary h-12"
                  />
                  <span className="text-2xl font-bold text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Changes are saved automatically</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tax Reports */}
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
                Tax Reports - {getPeriodLabel()}
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
                <Button variant="outline" onClick={handleExportAll}>
                  <Download className="w-4 h-4 mr-2" />
                  Export All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b">
                      <th className="pb-4 font-medium w-[180px]">Realtor</th>
                      <th className="pb-4 font-medium text-right w-[130px]">Gross Commission</th>
                      <th className="pb-4 font-medium text-center w-[80px]">VAT Rate</th>
                      <th className="pb-4 font-medium text-right w-[120px]">VAT Amount</th>
                      <th className="pb-4 font-medium text-right w-[130px]">Net Earnings</th>
                      <th className="pb-4 font-medium text-center w-[90px]">Status</th>
                      <th className="pb-4 font-medium text-center w-[100px]">Statement</th>
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
                        <td className="py-4 font-medium text-right">{formatCurrency(report.grossCommission)}</td>
                        <td className="py-4 text-center">{report.taxRate}%</td>
                        <td className="py-4 text-red-600 font-medium text-right">-{formatCurrency(report.taxAmount)}</td>
                        <td className="py-4 text-primary font-semibold text-right">{formatCurrency(report.netEarnings)}</td>
                        <td className="py-4 text-center">
                          <Badge className={report.status === 'FILED' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {report.status}
                          </Badge>
                        </td>
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
                    No tax reports found for the selected period.
                  </div>
                )}
              </div>
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
