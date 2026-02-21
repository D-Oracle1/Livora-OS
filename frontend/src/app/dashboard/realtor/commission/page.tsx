'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  Building2,
  ArrowUpRight,
  FileText,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, getTierBgClass } from '@/lib/utils';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

export default function RealtorCommissionPage() {
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [commissions, setCommissions] = useState<any[]>([]);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [commissionRates, setCommissionRates] = useState<Record<string, number>>({});
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [myTier, setMyTier] = useState<string | null>(null);

  const fetchCommissions = useCallback(async () => {
    try {
      const response: any = await api.get('/commissions?limit=100');
      const inner = response?.data ?? response;
      const records: any[] = Array.isArray(inner) ? inner : (Array.isArray(inner?.data) ? inner.data : []);
      const mapped = records.map((item: any) => ({
        id: item.id,
        sale: item.sale?.property?.title ?? item.saleTitle ?? 'Sale',
        property: item.sale?.property?.type ?? 'Property',
        saleAmount: Number(item.sale?.salePrice ?? item.sale?.totalAmount ?? item.saleAmount ?? 0),
        rate: item.rate != null ? Number(item.rate) * 100 : (item.commissionRate != null ? Number(item.commissionRate) * 100 : 0),
        commission: Number(item.amount ?? item.commissionAmount ?? 0),
        tax: Number(item.sale?.taxAmount ?? item.taxAmount ?? 0),
        net: Number(item.amount ?? item.commissionAmount ?? 0) - Number(item.sale?.taxAmount ?? item.taxAmount ?? 0),
        status: item.status || 'PENDING',
        date: item.paidAt || item.createdAt
          ? new Date(item.paidAt || item.createdAt).toISOString().split('T')[0]
          : '',
        paymentMethod: item.paymentMethod || '',
        paymentReference: item.paymentReference || '',
        paymentNotes: item.paymentNotes || '',
      }));
      setCommissions(mapped);
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();

    const fetchSettings = async () => {
      try {
        const res = await api.get<any>('/settings/commission-rates');
        const rates = res?.data ?? res;
        if (rates && typeof rates === 'object') {
          const converted: Record<string, number> = {};
          for (const [tier, rate] of Object.entries(rates)) {
            converted[tier] = Number(rate) * 100;
          }
          setCommissionRates(converted);
        }
      } catch {
        // keep defaults
      }

      try {
        const res = await api.get<any>('/settings/tax-rates');
        const data = res?.data ?? res;
        if (data?.vat != null) {
          setTaxRate(Math.round(Number(data.vat) * 100 * 100) / 100);
        }
      } catch {
        // keep default
      }

      try {
        const res = await api.get<any>('/auth/profile');
        const profile = res?.data ?? res;
        const tier = profile?.realtorProfile?.loyaltyTier ?? profile?.loyaltyTier;
        if (tier) setMyTier(tier);
      } catch {
        // keep default tier
      }
    };

    fetchSettings();
  }, [fetchCommissions]);

  const filterByTimePeriod = (date: string) => {
    const itemDate = new Date(date);
    const now = new Date();

    switch (timePeriod) {
      case 'month':
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return itemDate >= quarterStart;
      case 'year':
        return itemDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const filteredCommissions = useMemo(() => {
    return commissions.filter(item => filterByTimePeriod(item.date));
  }, [commissions, timePeriod]);

  const earningsBreakdown = useMemo(() => {
    const grossCommission = filteredCommissions.reduce((sum, item) => sum + item.commission, 0);
    const taxDeducted = filteredCommissions.reduce((sum, item) => sum + item.tax, 0);
    const netEarnings = filteredCommissions.reduce((sum, item) => sum + item.net, 0);
    const pendingPayment = filteredCommissions
      .filter(item => item.status === 'PENDING' || item.status === 'PROCESSING')
      .reduce((sum, item) => sum + item.net, 0);

    return {
      grossCommission,
      taxDeducted,
      netEarnings,
      pendingPayment,
      tier: myTier ?? 'BRONZE',
      rate: myTier ? (commissionRates[myTier] ?? 0) : 0,
    };
  }, [filteredCommissions, commissionRates, myTier]);

  const stats = useMemo(() => {
    const paidAmount = filteredCommissions
      .filter(item => item.status === 'PAID')
      .reduce((sum, item) => sum + item.net, 0);
    const thisMonthAmount = filteredCommissions
      .filter(item => {
        const date = new Date(item.date);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && item.status === 'PAID';
      })
      .reduce((sum, item) => sum + item.net, 0);

    return [
      { title: 'Total Earned', value: formatCurrency(paidAmount), icon: DollarSign, color: 'text-primary', bgColor: 'bg-primary/10' },
      { title: 'This Month', value: formatCurrency(thisMonthAmount), icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'Pending', value: formatCurrency(earningsBreakdown.pendingPayment), icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { title: 'Tax Deducted', value: formatCurrency(earningsBreakdown.taxDeducted), icon: Calculator, color: 'text-red-600', bgColor: 'bg-red-100' },
    ];
  }, [filteredCommissions, earningsBreakdown]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge variant="success">Paid</Badge>;
      case 'PENDING': return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending</Badge>;
      case 'PROCESSING': return <Badge variant="outline" className="border-blue-500 text-blue-500">Processing</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleViewReceipt = (item: typeof commissions[0]) => {
    const receiptData: ReceiptData = {
      receiptNumber: `COM-${item.id.toString().padStart(6, '0')}`,
      type: 'commission',
      date: item.date,
      seller: {
        name: companyName,
        email: branding.supportEmail || '',
        phone: branding.supportPhone || '',
        address: branding.address || '',
      },
      buyer: {
        name: 'Realtor Name', // Would come from auth context
        email: 'realtor@email.com',
      },
      property: {
        name: item.sale,
        type: item.property,
        address: 'Lagos, Nigeria',
      },
      items: [
        { description: `Commission on ${item.sale}`, amount: item.commission },
      ],
      subtotal: item.commission,
      fees: [
        { label: `Tax Deduction${taxRate !== null ? ` (${taxRate}%)` : ''}`, amount: -item.tax },
      ],
      total: item.net,
      status: item.status === 'PAID' ? 'paid' : 'pending',
      notes: [
        `Commission rate: ${item.rate}%`,
        item.paymentMethod ? `Payment method: ${item.paymentMethod.replace(/_/g, ' ')}` : '',
        item.paymentReference ? `Reference: ${item.paymentReference}` : '',
        item.paymentNotes || '',
      ].filter(Boolean).join(' | '),
    };
    setSelectedReceipt(receiptData);
    setReceiptModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ['Sale', 'Sale Amount', 'Rate', 'Commission', 'Tax', 'Net', 'Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...filteredCommissions.map(item => [
        `"${item.sale}"`,
        item.saleAmount,
        `${item.rate}%`,
        item.commission,
        item.tax,
        item.net,
        item.status,
        item.date,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-commissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Commission data exported successfully!');
  };

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  return (
    <div className="space-y-6">
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
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Earnings Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Earnings Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <Badge className={`${getTierBgClass(earningsBreakdown.tier)} mb-2`}>
                  {earningsBreakdown.tier} TIER
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Commission Rate: {earningsBreakdown.rate}%
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gross Commission</span>
                  <span className="font-semibold">{formatCurrency(earningsBreakdown.grossCommission)}</span>
                </div>
                <div className="flex items-center justify-between text-red-600">
                  <span>Tax Deducted{taxRate !== null ? ` (${taxRate}%)` : ''}</span>
                  <span className="font-semibold">-{formatCurrency(earningsBreakdown.taxDeducted)}</span>
                </div>
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="font-medium">Net Earnings</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(earningsBreakdown.netEarnings)}</span>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Payment</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(earningsBreakdown.pendingPayment)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Commission History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Commission History
                <Badge variant="outline" className="ml-2">{getTimePeriodLabel()}</Badge>
              </CardTitle>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-md text-sm"
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                >
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="all">All Time</option>
                </select>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b">
                      <th className="pb-4 font-medium min-w-[200px]">Sale</th>
                      <th className="pb-4 font-medium min-w-[120px]">Amount</th>
                      <th className="pb-4 font-medium min-w-[110px]">Commission</th>
                      <th className="pb-4 font-medium min-w-[100px]">Tax</th>
                      <th className="pb-4 font-medium min-w-[110px]">Net</th>
                      <th className="pb-4 font-medium min-w-[90px]">Status</th>
                      <th className="pb-4 font-medium min-w-[160px]">Payment Info</th>
                      <th className="pb-4 font-medium min-w-[60px]">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCommissions.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{item.sale}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-sm">{formatCurrency(item.saleAmount)}</td>
                        <td className="py-4 text-sm font-medium">{formatCurrency(item.commission)}</td>
                        <td className="py-4 text-sm text-red-600">-{formatCurrency(item.tax)}</td>
                        <td className="py-4 font-semibold text-primary">{formatCurrency(item.net)}</td>
                        <td className="py-4">{getStatusBadge(item.status)}</td>
                        <td className="py-4">
                          {item.status === 'PAID' ? (
                            <div className="text-xs">
                              {item.paymentMethod && (
                                <p className="font-medium text-green-700 dark:text-green-400">
                                  {item.paymentMethod.replace(/_/g, ' ')}
                                </p>
                              )}
                              {item.paymentReference && (
                                <p className="text-muted-foreground">Ref: {item.paymentReference}</p>
                              )}
                              {!item.paymentMethod && !item.paymentReference && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending payment</span>
                          )}
                        </td>
                        <td className="py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReceipt(item)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredCommissions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          No commissions found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        data={selectedReceipt}
        branding={branding}
      />
    </div>
  );
}
