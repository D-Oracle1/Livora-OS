'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Search,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  Settings,
  Save,
  FileText,
  Calendar,
  Download,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate, getTierBgClass } from '@/lib/utils';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

const TIER_META = [
  { tier: 'PLATINUM', realtors: 0, minSales: 40 },
  { tier: 'GOLD', realtors: 0, minSales: 25 },
  { tier: 'SILVER', realtors: 0, minSales: 10 },
  { tier: 'BRONZE', realtors: 0, minSales: 0 },
];

export default function CommissionPage() {
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [showRateSettings, setShowRateSettings] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [tierRates, setTierRates] = useState(TIER_META.map(t => ({ ...t, rate: 0 })));
  const [editingRates, setEditingRates] = useState(TIER_META.map(t => ({ ...t, rate: 0 })));
  const [commissions, setCommissions] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Payment dialog
  const [payDialog, setPayDialog] = useState<{ open: boolean; commission: any | null }>({ open: false, commission: null });
  const [payForm, setPayForm] = useState({ paymentMethod: 'BANK_TRANSFER', paymentReference: '', paymentNotes: '' });
  const [paying, setPaying] = useState(false);

  // Fetch commission rates from API
  const fetchCommissionRates = useCallback(async () => {
    try {
      const response = await api.get<any>('/settings/commission-rates');
      const rates = response?.data ?? response;
      // rates is like { BRONZE: 0.03, SILVER: 0.035, GOLD: 0.04, PLATINUM: 0.05 }
      const updated = TIER_META.map(meta => ({
        ...meta,
        rate: rates[meta.tier] !== undefined ? Number(rates[meta.tier]) * 100 : 0,
      }));
      setTierRates(updated);
      setEditingRates(updated);
    } catch {
      // API unavailable — show zeros until data loads
    } finally {
      setRatesLoaded(true);
    }
  }, []);

  // Fetch commission records from API
  const fetchCommissions = useCallback(async () => {
    try {
      const response: any = await api.get('/commissions?limit=100');
      // Handle { success, data: [...] | { data: [...], meta }, timestamp }
      const inner = response?.data ?? response;
      const records: any[] = Array.isArray(inner) ? inner : (Array.isArray(inner?.data) ? inner.data : []);
      const mapped = records.map((item: any) => {
        const realtorUser = item.realtor?.user ?? item.realtorProfile?.user;
        const realtorName = realtorUser
          ? `${realtorUser.firstName} ${realtorUser.lastName}`
          : (item.realtorName || 'Unknown');
        return {
          id: item.id,
          realtor: realtorName,
          email: realtorUser?.email || item.realtorEmail || '',
          tier: item.realtor?.loyaltyTier ?? item.realtorProfile?.loyaltyTier ?? 'BRONZE',
          sale: item.sale?.property?.title ?? item.saleTitle ?? 'N/A',
          saleAmount: Number(item.sale?.salePrice ?? item.sale?.totalAmount ?? item.saleAmount ?? 0),
          rate: item.rate != null ? Number(item.rate) * 100 : (item.commissionRate != null ? Number(item.commissionRate) * 100 : 0),
          commission: Number(item.amount ?? item.commissionAmount ?? item.commission ?? 0),
          status: item.status || 'PENDING',
          date: item.paidAt || item.createdAt || '',
          paymentMethod: item.paymentMethod || '',
          paymentReference: item.paymentReference || '',
          paymentNotes: item.paymentNotes || '',
        };
      });
      setCommissions(mapped);
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
    }
  }, []);

  useEffect(() => {
    fetchCommissionRates();
    fetchCommissions();
  }, [fetchCommissionRates, fetchCommissions]);

  // Filter commissions by time period
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return commissions.filter(commission => {
      const commissionDate = new Date(commission.date);
      const commissionMonth = commissionDate.getMonth();
      const commissionYear = commissionDate.getFullYear();

      switch (timePeriod) {
        case 'month':
          return commissionMonth === currentMonth && commissionYear === currentYear;
        case 'quarter':
          const currentQuarter = Math.floor(currentMonth / 3);
          const commissionQuarter = Math.floor(commissionMonth / 3);
          return commissionQuarter === currentQuarter && commissionYear === currentYear;
        case 'year':
          return commissionYear === currentYear || commissionYear === currentYear - 1;
        case 'all':
        default:
          return true;
      }
    });
  }, [timePeriod, commissions]);

  const filteredCommissions = filteredByTime.filter(commission => {
    const matchesSearch = commission.realtor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commission.sale.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || commission.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats based on filtered data
  const stats = useMemo(() => {
    const paidTotal = filteredByTime.filter(c => c.status === 'PAID').reduce((acc, c) => acc + c.commission, 0);
    const pendingTotal = filteredByTime.filter(c => c.status === 'PENDING').reduce((acc, c) => acc + c.commission, 0);
    const processingTotal = filteredByTime.filter(c => c.status === 'PROCESSING').reduce((acc, c) => acc + c.commission, 0);
    const totalCommission = filteredByTime.reduce((acc, c) => acc + c.commission, 0);
    const avgRate = filteredByTime.length > 0
      ? filteredByTime.reduce((acc, c) => acc + c.rate, 0) / filteredByTime.length
      : 0;

    return [
      { title: 'Total Paid', value: formatCurrency(paidTotal), icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'Pending', value: formatCurrency(pendingTotal), icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { title: 'Processing', value: formatCurrency(processingTotal), icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { title: 'Avg. Rate', value: `${avgRate.toFixed(1)}%`, icon: Calculator, color: 'text-primary', bgColor: 'bg-primary/10' },
    ];
  }, [filteredByTime]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'PENDING': return <Badge className="bg-orange-100 text-orange-800">Pending</Badge>;
      case 'PROCESSING': return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleSaveRates = async () => {
    try {
      const body: Record<string, number> = {};
      editingRates.forEach(tier => {
        body[tier.tier] = tier.rate / 100;
      });
      await api.put('/settings/commission-rates', body);
      setTierRates(editingRates);
      setShowRateSettings(false);
      toast.success('Commission rates updated successfully!');
    } catch (error: any) {
      console.error('Commission update error:', error);
      toast.error(error?.message || 'Failed to update commission rates. Please try again.');
    }
  };

  const openPayDialog = (commission: any) => {
    setPayForm({ paymentMethod: 'BANK_TRANSFER', paymentReference: '', paymentNotes: '' });
    setPayDialog({ open: true, commission });
  };

  const handleMarkAsPaid = async () => {
    if (!payDialog.commission) return;
    setPaying(true);
    try {
      await api.post(`/commissions/${payDialog.commission.id}/pay`, payForm);
      setCommissions(prev => prev.map(c =>
        c.id === payDialog.commission.id ? { ...c, status: 'PAID', paymentMethod: payForm.paymentMethod, paymentReference: payForm.paymentReference } : c
      ));
      toast.success('Commission marked as paid.');
      setPayDialog({ open: false, commission: null });
    } catch {
      toast.error('Failed to mark commission as paid.');
    } finally {
      setPaying(false);
    }
  };

  const handleRateChange = (tier: string, newRate: number) => {
    setEditingRates(prev => prev.map(r =>
      r.tier === tier ? { ...r, rate: newRate } : r
    ));
  };

  const generateReceipt = (commission: typeof commissions[0]) => {
    const taxRate = 15;
    const taxAmount = commission.commission * (taxRate / 100);
    const netAmount = commission.commission - taxAmount;

    const receipt: ReceiptData = {
      type: 'commission',
      receiptNumber: `COM-${commission.id.toString().padStart(6, '0')}`,
      date: formatDate(commission.date),
      seller: {
        name: companyName,
        email: branding.supportEmail || '',
        phone: branding.supportPhone || '',
        address: branding.address || '',
      },
      buyer: {
        name: commission.realtor,
        email: commission.email,
      },
      property: {
        name: commission.sale,
        address: 'Lagos, Nigeria',
        type: 'Property Sale',
      },
      items: [
        {
          description: `Commission for: ${commission.sale}`,
          amount: commission.commission,
        },
      ],
      subtotal: commission.commission,
      fees: [
        {
          label: `Tax (${taxRate}%)`,
          amount: -taxAmount,
        },
      ],
      total: netAmount,
      status: commission.status === 'PAID' ? 'paid' : 'pending',
      notes: `Commission rate: ${commission.rate}% | Sale Amount: ${formatCurrency(commission.saleAmount)}`,
    };

    setReceiptData(receipt);
    setShowReceipt(true);
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
      {/* Time Period Filter */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <h1 className="text-2xl font-bold">Commission Management</h1>
        <div className="flex gap-2">
          <Button
            variant={timePeriod === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimePeriod('month')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            This Month
          </Button>
          <Button
            variant={timePeriod === 'quarter' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimePeriod('quarter')}
          >
            Quarter
          </Button>
          <Button
            variant={timePeriod === 'year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimePeriod('year')}
          >
            This Year
          </Button>
          <Button
            variant={timePeriod === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimePeriod('all')}
          >
            All Time
          </Button>
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
        {/* Commission Rates by Tier */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Commission Rates
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                setEditingRates(tierRates);
                setShowRateSettings(true);
              }}>
                <Settings className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {tierRates.map((tier) => (
                <div key={tier.tier} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={getTierBgClass(tier.tier)}>{tier.tier}</Badge>
                    <span className="text-xl font-bold text-primary">{tier.rate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{tier.realtors} realtors</span>
                    <span>Min. {tier.minSales} sales</span>
                  </div>
                </div>
              ))}
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
                Commission Payments - {getPeriodLabel()}
              </CardTitle>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 w-full sm:w-40"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="px-3 py-2 border rounded-md text-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b">
                      <th className="pb-4 font-medium w-[200px]">Realtor</th>
                      <th className="pb-4 font-medium w-[200px]">Sale</th>
                      <th className="pb-4 font-medium text-right w-[120px]">Amount</th>
                      <th className="pb-4 font-medium text-center w-[60px]">Rate</th>
                      <th className="pb-4 font-medium text-right w-[120px]">Commission</th>
                      <th className="pb-4 font-medium text-center w-[100px]">Status</th>
                      <th className="pb-4 font-medium text-center w-[80px]">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCommissions.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarFallback className="bg-primary text-white text-xs">
                                {item.realtor.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{item.realtor}</p>
                              <Badge className={`${getTierBgClass(item.tier)} text-xs`}>{item.tier}</Badge>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <p className="text-sm truncate max-w-[180px]" title={item.sale}>{item.sale}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                        </td>
                        <td className="py-4 text-sm text-right">{formatCurrency(item.saleAmount)}</td>
                        <td className="py-4 text-sm text-center">{item.rate}%</td>
                        <td className="py-4 font-semibold text-primary text-right">{formatCurrency(item.commission)}</td>
                        <td className="py-4 text-center">{getStatusBadge(item.status)}</td>
                        <td className="py-4 text-center flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateReceipt(item)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {item.status !== 'PAID' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPayDialog(item)}
                              title="Record Payment"
                            >
                              <Send className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {item.status === 'PAID' && item.paymentReference && (
                            <span className="text-xs text-muted-foreground" title={`Ref: ${item.paymentReference}`}>
                              #{item.paymentReference.substring(0, 8)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredCommissions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No commissions found for the selected filters.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Rate Settings Dialog */}
      <Dialog open={showRateSettings} onOpenChange={setShowRateSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Edit Commission Rates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingRates.map((tier) => (
              <div key={tier.tier} className="flex items-center gap-4">
                <Badge className={`${getTierBgClass(tier.tier)} w-24 justify-center`}>{tier.tier}</Badge>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={tier.rate}
                      onChange={(e) => handleRateChange(tier.tier, parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {tier.realtors} realtors
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRateSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRates}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <ReceiptModal
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        data={receiptData}
        branding={branding}
      />

      {/* Payment Recording Dialog */}
      <Dialog open={payDialog.open} onOpenChange={(o) => !o && setPayDialog({ open: false, commission: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Commission Payment</DialogTitle>
            <DialogDescription>
              {payDialog.commission && (
                <span>
                  Commission for <strong>{payDialog.commission.realtor}</strong> — {formatCurrency(payDialog.commission.commission)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE_TRANSFER">Online Transfer</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Reference / Transaction ID</Label>
              <Input
                placeholder="e.g. TXN-2024-001, Cheque #12345"
                value={payForm.paymentReference}
                onChange={(e) => setPayForm(f => ({ ...f, paymentReference: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any additional notes about this payment..."
                value={payForm.paymentNotes}
                onChange={(e) => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog({ open: false, commission: null })} disabled={paying}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={paying}>
              {paying ? <><span className="animate-spin mr-2">⏳</span>Processing...</> : <><Send className="w-4 h-4 mr-2" />Mark as Paid</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
