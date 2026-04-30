'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  TrendingUp,
  Calendar,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Download,
  User,
  Phone,
  Mail,
  MapPin,
  Eye,
  Square,
  Clock,
  AlertCircle,
  Banknote,
  Plus,
  Home,
  LandPlot,
  Users,
  ChevronLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate, getTierBgClass, formatArea, type AreaUnit, AREA_UNITS, toSqm, fromSqm } from '@/lib/utils';
import { NairaSign } from '@/components/icons/naira-sign';
import { AreaUnitSelect } from '@/components/area-unit-select';
import { api } from '@/lib/api';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

interface Sale {
  id: number | string;
  property: string;
  propertyType: string;
  propertyAddress: string;
  buyer: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerAddress: string;
  realtor: string;
  realtorEmail: string;
  realtorTier: string;
  amount: number;
  commission: number;
  plotsSold: number;
  sqmSold: number;
  pricePerSqm: number;
  paymentMethod: string;
  notes: string;
  date: string;
  status: string;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  numberOfInstallments: number;
  totalPaid: number;
  remainingBalance: number;
  payments: Array<{ number: number; amount: number; date: string; commission: number; tax: number; method: string; reference: string }>;
  nextPaymentDue: string | null;
}

const sales: Sale[] = [];

export default function SalesPage() {
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [salesData, setSalesData] = useState<Sale[]>(sales);
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Report sale state
  const [showReportSale, setShowReportSale] = useState(false);
  const [reportStep, setReportStep] = useState<'property' | 'form'>('property');
  const [reportProperties, setReportProperties] = useState<any[]>([]);
  const [reportPropertiesLoading, setReportPropertiesLoading] = useState(false);
  const [reportPropertySearch, setReportPropertySearch] = useState('');
  const [reportSelectedProperty, setReportSelectedProperty] = useState<any>(null);
  const [reportRealtors, setReportRealtors] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([]);
  const [reportAttribution, setReportAttribution] = useState<'REALTOR' | 'COMPANY'>('REALTOR');
  const [reportSelectedRealtorId, setReportSelectedRealtorId] = useState('');
  const [reportAreaUnit, setReportAreaUnit] = useState<AreaUnit>('plot');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState({
    buyerFirstName: '', buyerLastName: '', buyerEmail: '', buyerPhone: '',
    sqmSold: '', pricePerSqm: '', totalAmount: '', notes: '',
    paymentMethod: 'BANK_TRANSFER', paymentPlan: 'FULL' as 'FULL' | 'INSTALLMENT',
    numberOfInstallments: '2', firstPaymentAmount: '',
    saleDate: new Date().toISOString().split('T')[0],
  });

  const fetchSales = useCallback(async () => {
    try {
      const response: any = await api.get('/sales?page=1&limit=500');
      // Unwrap TransformInterceptor { success, data: { data, meta }, timestamp }
      const wrapped = response?.data || response;
      const items = Array.isArray(wrapped) ? wrapped : (wrapped?.data || []);
      const mapped: Sale[] = items.map((s: any) => ({
        id: s.id,
        property: s.property?.title || '',
        propertyType: s.property?.type || 'Land',
        propertyAddress: s.property?.address || s.property?.city || '',
        buyer: `${s.client?.user?.firstName || ''} ${s.client?.user?.lastName || ''}`.trim() || '',
        buyerEmail: s.client?.user?.email || '',
        buyerPhone: s.client?.user?.phone || '',
        buyerAddress: s.client?.address || s.client?.city || '',
        realtor: s.realtorId ? (`${s.realtor?.user?.firstName || ''} ${s.realtor?.user?.lastName || ''}`.trim() || 'Unknown') : 'Company',
        realtorEmail: s.realtor?.user?.email || '',
        realtorTier: s.realtorId ? (s.realtor?.loyaltyTier || 'BRONZE') : '',
        // For installment sales report on how much has been paid, not the full contract value
        amount: s.paymentPlan === 'INSTALLMENT'
          ? (Number(s.totalPaid) || 0)
          : (Number(s.salePrice) || 0),
        commission: Number(s.commissionAmount) || 0,
        plotsSold: 1,
        sqmSold: Number(s.areaSold) || 0,
        pricePerSqm: 0,
        paymentMethod: s.paymentPlan || 'FULL',
        notes: s.notes || '',
        date: s.saleDate ? new Date(s.saleDate).toISOString().split('T')[0] : (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : ''),
        status: s.status || 'PENDING',
        paymentPlan: s.paymentPlan || 'FULL',
        numberOfInstallments: s.numberOfInstallments || 1,
        totalPaid: Number(s.totalPaid) || 0,
        remainingBalance: Number(s.remainingBalance) || 0,
        payments: (s.payments || []).map((p: any) => ({
          number: p.paymentNumber || 0,
          amount: Number(p.amount) || 0,
          date: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '',
          commission: Number(p.commissionAmount) || 0,
          tax: Number(p.taxAmount) || 0,
          method: p.paymentMethod || '',
          reference: p.reference || '',
        })),
        nextPaymentDue: s.nextPaymentDue || null,
      }));
      setSalesData(mapped);
    } catch {
      // API unavailable, keep mock data
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleDetail, setShowSaleDetail] = useState(false);

  // Filter by time period
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return salesData.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleMonth = saleDate.getMonth();
      const saleYear = saleDate.getFullYear();

      switch (timePeriod) {
        case 'month':
          return saleMonth === currentMonth && saleYear === currentYear;
        case 'quarter':
          const currentQuarter = Math.floor(currentMonth / 3);
          const saleQuarter = Math.floor(saleMonth / 3);
          const quarterStart = new Date(currentYear, currentQuarter * 3, 1);
          return saleDate >= quarterStart && saleYear === currentYear;
        case 'year':
          return saleYear === currentYear;
        case 'all':
        default:
          return true;
      }
    });
  }, [salesData, timePeriod]);

  const pendingSales = filteredByTime.filter(s => s.status === 'PENDING');

  const filteredSales = filteredByTime.filter(sale => {
    const matchesSearch = sale.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.realtor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.buyer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || sale.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = useMemo(() => {
    // Include both COMPLETED and IN_PROGRESS (active installment sales) for total sales value
    const activeSales = filteredByTime.filter(s => s.status === 'COMPLETED' || s.status === 'IN_PROGRESS');
    const totalSales = activeSales.reduce((acc, s) => acc + s.amount, 0);
    const completedCount = filteredByTime.filter(s => s.status === 'COMPLETED').length;
    const inProgressCount = filteredByTime.filter(s => s.status === 'IN_PROGRESS').length;
    const pendingCount = filteredByTime.filter(s => s.status === 'PENDING').length;
    const avgSalePrice = activeSales.length > 0 ? totalSales / activeSales.length : 0;

    return [
      { title: 'Total Sales', value: formatCurrency(totalSales), change: `${activeSales.length} active`, trend: 'up', icon: NairaSign, color: 'text-primary', bgColor: 'bg-primary/10' },
      { title: 'Completed', value: completedCount.toString(), change: '', trend: 'up', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'In Progress', value: inProgressCount.toString(), change: `${pendingCount} pending`, trend: 'up', icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { title: 'Avg. Sale Price', value: formatCurrency(avgSalePrice), change: '', trend: 'down', icon: Building2, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    ];
  }, [filteredByTime]);

  const handleConfirmSale = async (saleId: number | string) => {
    setProcessingId(saleId);
    try {
      await api.patch(`/sales/${saleId}/approve`, {});
      toast.success('Sale approved successfully!');
      await fetchSales();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve sale. Backend may be offline.');
    } finally {
      setProcessingId(null);
      setShowSaleDetail(false);
    }
  };

  const handleCancelSale = async (saleId: number | string) => {
    if (!confirm('Are you sure you want to reject this sale report?')) return;

    setProcessingId(saleId);
    try {
      await api.patch(`/sales/${saleId}/reject`, {});
      toast.success('Sale report rejected.');
      await fetchSales();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject sale. Backend may be offline.');
    } finally {
      setProcessingId(null);
      setShowSaleDetail(false);
    }
  };

  const handleDeleteSale = async (saleId: number | string) => {
    if (!confirm('Permanently delete this cancelled sale? This cannot be undone.')) return;
    setProcessingId(saleId);
    try {
      await api.delete(`/sales/${saleId}`);
      toast.success('Sale permanently deleted.');
      await fetchSales();
      setShowSaleDetail(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete sale.');
    } finally {
      setProcessingId(null);
    }
  };

  const openRecordPayment = (sale: Sale) => {
    setPaymentSale(sale);
    setPaymentAmount('');
    setPaymentMethod('BANK_TRANSFER');
    setPaymentReference('');
    setPaymentNotes('');
    setShowRecordPayment(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentSale || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }
    if (amount > paymentSale.remainingBalance) {
      toast.error(`Amount exceeds remaining balance of ${formatCurrency(paymentSale.remainingBalance)}`);
      return;
    }
    setRecordingPayment(true);
    try {
      await api.post(`/sales/${paymentSale.id}/payments`, {
        amount,
        paymentMethod,
        paymentDate: new Date().toISOString().split('T')[0],
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully!`);
      setShowRecordPayment(false);
      setPaymentSale(null);
      await fetchSales();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const openSaleDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setShowSaleDetail(true);
  };

  const generateReceipt = (sale: Sale) => {
    const receipt: ReceiptData = {
      type: 'sale',
      receiptNumber: `ELNG-${new Date(sale.date || Date.now()).getFullYear().toString().slice(-2)}-${sale.id.toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      date: sale.date,
      seller: {
        name: companyName,
        address: branding.address || '',
      },
      buyer: {
        name: sale.buyer,
        email: sale.buyerEmail,
        phone: sale.buyerPhone,
        address: sale.buyerAddress,
      },
      property: {
        name: sale.property,
        address: sale.propertyAddress || '',
        type: sale.propertyType,
      },
      description: (() => { const qty = sale.plotsSold > 0 ? sale.plotsSold : 1; const isLand = (sale.propertyType || 'Land') === 'Land'; const unit = isLand ? (qty === 1 ? 'plot' : 'plots') : (qty === 1 ? 'unit' : 'units'); return `Purchase of ${qty} ${unit} of ${sale.propertyType || 'Land'} lying and situate at ${sale.property}${sale.propertyAddress ? `, ${sale.propertyAddress}` : ''}.`; })(),
      realtorName: sale.realtor !== 'Company' ? sale.realtor : undefined,
      items: [
        {
          description: `Property Sale: ${sale.property}`,
          quantity: sale.plotsSold > 0 ? sale.plotsSold : 1,
          unitPrice: sale.plotsSold > 0 ? sale.amount / sale.plotsSold : sale.amount,
          amount: sale.amount,
        },
      ],
      subtotal: sale.amount,
      fees: [],
      total: sale.amount,
      status: sale.status === 'COMPLETED' ? 'completed' : sale.status === 'CANCELLED' ? 'cancelled' : 'pending',
      notes: sale.notes || undefined,
      ...(sale.paymentPlan === 'INSTALLMENT' ? {
        paymentHistory: sale.payments.map(p => ({
          number: p.number,
          amount: p.amount,
          date: p.date,
          method: p.method,
          reference: p.reference,
          commission: p.commission,
          tax: p.tax,
        })),
        totalPaid: sale.totalPaid,
        remainingBalance: sale.remainingBalance,
      } : {}),
    };

    setReceiptData(receipt);
    setShowReceipt(true);
  };

  const openReportSaleDialog = async () => {
    setReportStep('property');
    setReportSelectedProperty(null);
    setReportPropertySearch('');
    setShowReportSale(true);
    setReportPropertiesLoading(true);
    try {
      const res: any = await api.get('/properties?limit=200');
      const wrapped = res?.data || res;
      setReportProperties(Array.isArray(wrapped) ? wrapped : (wrapped?.data || []));
    } catch { setReportProperties([]); }
    finally { setReportPropertiesLoading(false); }
    try {
      const res: any = await api.get('/realtors/directory');
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setReportRealtors(list);
    } catch { setReportRealtors([]); }
  };

  const selectReportProperty = (property: any) => {
    setReportSelectedProperty(property);
    const isLand = property.type === 'LAND';
    const ppsqm = Number(property.pricePerSqm) || 0;
    setReportAreaUnit('plot');
    setReportAttribution('REALTOR');
    setReportSelectedRealtorId('');
    setReportForm({
      buyerFirstName: '', buyerLastName: '', buyerEmail: '', buyerPhone: '',
      sqmSold: String(property.area || 0),
      pricePerSqm: String(ppsqm),
      totalAmount: isLand && ppsqm > 0 ? String(ppsqm * (property.area || 0)) : String(Number(property.price) || 0),
      notes: '', paymentMethod: 'BANK_TRANSFER', paymentPlan: 'FULL',
      numberOfInstallments: '2', firstPaymentAmount: '',
      saleDate: new Date().toISOString().split('T')[0],
    });
    setReportStep('form');
  };

  const updateReportForm = (field: string, value: string) => {
    setReportForm(prev => {
      const updated = { ...prev, [field]: value };
      if (reportSelectedProperty?.type === 'LAND' && (field === 'sqmSold' || field === 'pricePerSqm')) {
        const sqm = parseFloat(field === 'sqmSold' ? value : updated.sqmSold) || 0;
        const price = parseFloat(field === 'pricePerSqm' ? value : updated.pricePerSqm) || 0;
        updated.totalAmount = (sqm * price).toString();
      }
      return updated;
    });
  };

  const handleReportAreaUnitChange = (newUnit: AreaUnit) => {
    const currentValue = parseFloat(reportForm.sqmSold) || 0;
    if (currentValue > 0) {
      const inSqm = toSqm(currentValue, reportAreaUnit);
      const converted = fromSqm(inSqm, newUnit);
      setReportForm(prev => ({ ...prev, sqmSold: converted % 1 === 0 ? String(converted) : converted.toFixed(2) }));
    }
    setReportAreaUnit(newUnit);
  };

  const handleSubmitReportSale = async () => {
    if (reportAttribution === 'REALTOR' && !reportSelectedRealtorId) {
      toast.error('Please select a realtor to attribute this sale to'); return;
    }
    if (!reportForm.buyerFirstName || !reportForm.buyerLastName || !reportForm.buyerEmail) {
      toast.error('Please fill in buyer name and email'); return;
    }
    if (!reportForm.totalAmount || parseFloat(reportForm.totalAmount) <= 0) {
      toast.error('Please enter a sale amount'); return;
    }
    if (reportForm.paymentPlan === 'INSTALLMENT' && (parseFloat(reportForm.firstPaymentAmount) || 0) <= 0) {
      toast.error('Please enter a first payment amount'); return;
    }
    setReportSubmitting(true);
    try {
      const payload: any = {
        clientName: `${reportForm.buyerFirstName} ${reportForm.buyerLastName}`,
        clientEmail: reportForm.buyerEmail,
        clientContact: reportForm.buyerPhone || undefined,
        propertyId: reportSelectedProperty.id,
        saleValue: parseFloat(reportForm.totalAmount),
        saleDate: reportForm.saleDate,
        notes: reportForm.notes || undefined,
        paymentPlan: reportForm.paymentPlan,
        paymentMethod: reportForm.paymentMethod || undefined,
        areaSold: toSqm(parseFloat(reportForm.sqmSold) || 0, reportAreaUnit) || undefined,
        ...(reportAttribution === 'REALTOR' && reportSelectedRealtorId ? { realtorId: reportSelectedRealtorId } : {}),
      };
      if (reportForm.paymentPlan === 'INSTALLMENT') {
        payload.numberOfInstallments = parseInt(reportForm.numberOfInstallments) || 2;
        payload.firstPaymentAmount = parseFloat(reportForm.firstPaymentAmount) || 0;
      }
      await api.post('/sales', payload);
      toast.success('Sale reported successfully!');
      setShowReportSale(false);
      fetchSales();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to report sale');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleExportAll = () => {
    const csvContent = [
      ['Property', 'Type', 'Buyer', 'Buyer Email', 'Buyer Phone', 'Realtor', 'Plots Sold', 'SQM Sold', 'Amount', 'Commission', 'Payment Method', 'Date', 'Status'].join(','),
      ...filteredSales.map(s =>
        [s.property, s.propertyType, s.buyer, s.buyerEmail, s.buyerPhone, s.realtor, s.plotsSold, s.sqmSold, s.amount, s.commission, s.paymentMethod, s.date, s.status].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales-report-${timePeriod}.csv`;
    link.click();
    toast.success('Sales report exported!');
  };

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      case 'all': return 'All Time';
    }
  };

  const getProgressBarColor = (sale: Sale) => {
    if (sale.remainingBalance <= 0) return 'bg-green-500';
    if (sale.nextPaymentDue && new Date(sale.nextPaymentDue) < new Date()) return 'bg-red-500';
    return 'bg-[#fca639]';
  };

  const getBadgeColor = (sale: Sale) => {
    if (sale.remainingBalance <= 0) return 'bg-green-100 text-green-700';
    if (sale.nextPaymentDue && new Date(sale.nextPaymentDue) < new Date()) return 'bg-red-100 text-red-700';
    return 'bg-[#fca639]/10 text-[#fca639]';
  };

  const getPaymentCounterText = (sale: Sale) => {
    if (sale.remainingBalance <= 0) return `${sale.payments.length}/${sale.payments.length} paid`;
    return `${sale.payments.length}/${sale.numberOfInstallments} paid`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Sales Management</h1>
          <p className="text-sm text-muted-foreground">View, approve and report sales</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={openReportSaleDialog}>
            <Plus className="w-4 h-4" />
            Report Sale
          </Button>
          {['month', 'quarter', 'year', 'all'].map((p) => (
            <Button
              key={p}
              variant={timePeriod === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(p as TimePeriod)}
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
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  {stat.change && (
                    <div className={`flex items-center gap-1 text-sm ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {stat.change}
                    </div>
                  )}
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pending Approvals */}
      {pendingSales.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="w-5 h-5" />
                Pending Sale Reports ({pendingSales.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm">{sale.property}</h4>
                        <p className="text-xs text-muted-foreground">
                          Reported by <span className="font-medium">{sale.realtor}</span> &bull; Buyer: <span className="font-medium">{sale.buyer}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {sale.propertyType === 'Land' && (
                            <Badge variant="outline" className="text-xs">{formatArea(sale.sqmSold)}</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{sale.paymentMethod.replace('_', ' ')}</Badge>
                          {sale.paymentPlan === 'INSTALLMENT' && (
                            <Badge className={`${getBadgeColor(sale)} text-xs`}>
                              Installment {getPaymentCounterText(sale)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-bold text-[#2b1464]">{formatCurrency(sale.amount)}</p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => openSaleDetail(sale)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-[#2b1464] hover:bg-[#1e0e47]"
                          onClick={() => handleConfirmSale(sale.id)}
                          disabled={processingId === sale.id}
                        >
                          {processingId === sale.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() => handleCancelSale(sale.id)}
                          disabled={processingId === sale.id}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* All Sales */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <NairaSign className="w-5 h-5 text-primary" />
              All Reported Sales - {getPeriodLabel()}
            </CardTitle>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search sales..."
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
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <Button variant="outline" onClick={handleExportAll}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-4 pr-4 font-medium w-[220px]">Property</th>
                    <th className="pb-4 pr-4 font-medium w-[150px]">Buyer</th>
                    <th className="pb-4 pr-4 font-medium w-[140px]">Reported By</th>
                    <th className="pb-4 pr-4 font-medium text-center w-[90px]">Qty</th>
                    <th className="pb-4 pr-4 font-medium text-right w-[120px]">Amount</th>
                    <th className="pb-4 pr-4 font-medium text-right w-[110px]">Commission</th>
                    <th className="pb-4 pr-4 font-medium text-center w-[90px]">Plan</th>
                    <th className="pb-4 pr-4 font-medium text-center w-[90px]">Date</th>
                    <th className="pb-4 pr-4 font-medium text-center w-[90px]">Status</th>
                    <th className="pb-4 font-medium text-center w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => openSaleDetail(sale)}>
                      <td className="py-4 pr-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm leading-snug">{sale.property}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{sale.propertyType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <p className="text-sm font-medium leading-snug">{sale.buyer}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sale.buyerPhone}</p>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <div className="flex items-start gap-2">
                          <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                            <AvatarFallback className="bg-primary text-white text-xs">
                              {sale.realtor.split(' ').filter(Boolean).map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm leading-snug">{sale.realtor}</p>
                            {sale.realtorTier && <Badge className={`${getTierBgClass(sale.realtorTier)} text-[10px] mt-0.5`}>{sale.realtorTier}</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-center text-sm">
                        {sale.propertyType === 'Land' ? (
                          <div>
                            <p className="font-medium">{sale.plotsSold} plot(s)</p>
                            <p className="text-xs text-muted-foreground">{formatArea(sale.sqmSold)}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">1 unit</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 font-semibold text-right align-top">{formatCurrency(sale.amount)}</td>
                      <td className="py-4 pr-4 text-primary font-medium text-right align-top">{formatCurrency(sale.commission)}</td>
                      <td className="py-4 pr-4 text-center align-top">
                        {sale.paymentPlan === 'INSTALLMENT' ? (
                          <div className="inline-flex flex-col items-center">
                            <Badge className={`${getBadgeColor(sale)} text-[10px] mb-1`}>
                              {getPaymentCounterText(sale)}
                            </Badge>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                              <div
                                className={`h-full ${getProgressBarColor(sale)} rounded-full transition-all`}
                                style={{ width: `${Math.min((sale.totalPaid / sale.amount) * 100, 100)}%` }}
                              />
                            </div>
                            {sale.nextPaymentDue && new Date(sale.nextPaymentDue) < new Date() && sale.remainingBalance > 0 && (
                              <span className="text-[9px] text-red-600 font-medium mt-0.5">Overdue</span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Full</Badge>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground text-center text-sm align-top">{formatDate(sale.date)}</td>
                      <td className="py-4 pr-4 text-center align-top">
                        <Badge className={
                          sale.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          sale.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          sale.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-orange-100 text-orange-800'
                        }>
                          {sale.status === 'COMPLETED' ? 'Completed' :
                           sale.status === 'IN_PROGRESS' ? 'In Progress' :
                           sale.status === 'CANCELLED' ? 'Cancelled' :
                           sale.status === 'PENDING' ? 'Pending' : sale.status}
                        </Badge>
                      </td>
                      <td className="py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {sale.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:bg-green-50 h-8 px-2"
                                onClick={() => handleConfirmSale(sale.id)}
                                disabled={processingId === sale.id}
                              >
                                {processingId === sale.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50 h-8 px-2"
                                onClick={() => handleCancelSale(sale.id)}
                                disabled={processingId === sale.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {sale.paymentPlan === 'INSTALLMENT' && sale.remainingBalance > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#fca639] hover:bg-[#fca639]/10 h-8 px-2"
                              onClick={() => openRecordPayment(sale)}
                              title="Record Payment"
                            >
                              <Banknote className="w-4 h-4" />
                            </Button>
                          )}
                          {sale.status === 'CANCELLED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 h-8 px-2"
                              onClick={() => handleDeleteSale(sale.id)}
                              disabled={processingId === sale.id}
                              title="Delete permanently"
                            >
                              {processingId === sale.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => generateReceipt(sale)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSales.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No sales found for the selected filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sale Detail Dialog */}
      <Dialog open={showSaleDetail} onOpenChange={setShowSaleDetail}>
        <DialogContent className="max-w-2xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          {selectedSale && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Sale Report Details
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {/* Status Banner */}
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  selectedSale.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border border-green-200' :
                  selectedSale.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  {selectedSale.status === 'COMPLETED' ? <CheckCircle className="w-4 h-4" /> :
                   selectedSale.status === 'CANCELLED' ? <XCircle className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                  {selectedSale.status === 'COMPLETED' ? 'This sale has been approved' :
                   selectedSale.status === 'CANCELLED' ? 'This sale report was rejected' :
                   'This sale report is pending approval'}
                </div>

                {/* Property Details */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Property
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="font-medium text-sm">{selectedSale.property}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium text-sm">{selectedSale.propertyType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date Reported</p>
                      <p className="font-medium text-sm">{formatDate(selectedSale.date)}</p>
                    </div>
                  </div>
                </div>

                {/* Buyer Details */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Buyer Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="font-medium text-sm">{selectedSale.buyer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selectedSale.buyerPhone}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {selectedSale.buyerEmail}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {selectedSale.buyerAddress}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sale Details */}
                <div className="p-4 bg-[#2b1464]/5 rounded-lg border border-[#2b1464]/20">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-[#2b1464]">
                    <NairaSign className="w-4 h-4" />
                    Sale Breakdown
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedSale.propertyType === 'Land' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Plots Sold</p>
                          <p className="text-xl font-bold">{selectedSale.plotsSold}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Size</p>
                          <p className="text-xl font-bold">{formatArea(selectedSale.sqmSold)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Price/plot</p>
                          <p className="text-xl font-bold">{formatCurrency(selectedSale.pricePerSqm)}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-bold text-[#2b1464]">{formatCurrency(selectedSale.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Commission</p>
                      <p className="text-xl font-bold text-[#fca639]">{formatCurrency(selectedSale.commission)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Method</p>
                      <p className="font-medium">{selectedSale.paymentMethod.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                {/* Payment History (Installment Sales) */}
                {selectedSale.paymentPlan === 'INSTALLMENT' && (
                  <div className="p-4 bg-[#fca639]/5 rounded-lg border border-[#fca639]/20">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-[#fca639]">
                      <Banknote className="w-4 h-4" />
                      Payment Progress ({getPaymentCounterText(selectedSale)})
                      {selectedSale.nextPaymentDue && new Date(selectedSale.nextPaymentDue) < new Date() && selectedSale.remainingBalance > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-[10px] ml-2">Overdue</Badge>
                      )}
                    </h4>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Paid: {formatCurrency(selectedSale.totalPaid)}</span>
                        <span>Total: {formatCurrency(selectedSale.amount)}</span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full">
                        <div
                          className={`h-full ${getProgressBarColor(selectedSale)} rounded-full transition-all`}
                          style={{ width: `${Math.min((selectedSale.totalPaid / selectedSale.amount) * 100, 100)}%` }}
                        />
                      </div>
                      {selectedSale.remainingBalance > 0 ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Remaining: {formatCurrency(selectedSale.remainingBalance)}
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 font-medium mt-1">Fully Paid</p>
                      )}
                    </div>
                    {/* Payment List */}
                    <div className="space-y-2">
                      {selectedSale.payments.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">No payments recorded yet.</p>
                      )}
                      {selectedSale.payments.map((p) => (
                        <div key={p.number} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#fca639]/10 flex items-center justify-center text-xs font-bold text-[#fca639]">
                              #{p.number}
                            </div>
                            <div>
                              <p className="font-medium">{formatCurrency(p.amount)}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(p.date)}</p>
                              {p.method && (
                                <p className="text-xs text-muted-foreground">{p.method.replace('_', ' ')}{p.reference ? ` — ${p.reference}` : ''}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-primary">Commission: {formatCurrency(p.commission)}</p>
                            <p className="text-xs text-red-500">Tax: {formatCurrency(p.tax)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Realtor Info */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Reported By</h4>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary text-white">
                        {selectedSale.realtor.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedSale.realtor}</p>
                      <div className="flex items-center gap-2">
                        {selectedSale.realtorTier && <Badge className={getTierBgClass(selectedSale.realtorTier)}>{selectedSale.realtorTier}</Badge>}
                        {selectedSale.realtorEmail && <span className="text-xs text-muted-foreground">{selectedSale.realtorEmail}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedSale.notes && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
                    <h4 className="font-semibold mb-1 text-sm">Realtor Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedSale.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                {selectedSale.status === 'PENDING' && (
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelSale(selectedSale.id)}
                      disabled={processingId === selectedSale.id}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="flex-1 bg-[#2b1464] hover:bg-[#1e0e47]"
                      onClick={() => handleConfirmSale(selectedSale.id)}
                      disabled={processingId === selectedSale.id}
                    >
                      {processingId === selectedSale.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Approve Sale
                    </Button>
                  </div>
                )}
                {selectedSale.status !== 'PENDING' && (
                  <div className="flex gap-2">
                    {selectedSale.status === 'CANCELLED' && (
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteSale(selectedSale.id)}
                        disabled={processingId === selectedSale.id}
                      >
                        {processingId === selectedSale.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-2" />
                        )}
                        Delete Permanently
                      </Button>
                    )}
                    {selectedSale.paymentPlan === 'INSTALLMENT' && selectedSale.remainingBalance > 0 && (
                      <Button
                        className="bg-[#fca639] hover:bg-[#e8953a] text-white"
                        onClick={() => { setShowSaleDetail(false); openRecordPayment(selectedSale); }}
                      >
                        <Banknote className="w-4 h-4 mr-2" />
                        Record Payment
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => generateReceipt(selectedSale)}>
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Receipt
                    </Button>
                    <Button variant="outline" onClick={() => setShowSaleDetail(false)}>
                      Close
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#fca639]" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          {paymentSale && (
            <div className="space-y-4">
              {/* Sale summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="font-medium text-sm">{paymentSale.property}</p>
                <p className="text-xs text-muted-foreground">Buyer: {paymentSale.buyer}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Paid: {formatCurrency(paymentSale.totalPaid)} of {formatCurrency(paymentSale.amount)}
                </p>
                <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-full bg-[#fca639] rounded-full"
                    style={{ width: `${paymentSale.amount > 0 ? (paymentSale.totalPaid / paymentSale.amount) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs font-medium mt-1">
                  Remaining: <span className="text-orange-600">{formatCurrency(paymentSale.remainingBalance)}</span>
                </p>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Amount (₦) *</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="POS">POS</option>
                </select>
              </div>

              {/* Reference */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Reference / Receipt No.</label>
                <Input
                  placeholder="e.g., TRF-123456"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  placeholder="Optional notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRecordPayment(false)}>Cancel</Button>
                <Button
                  className="bg-[#fca639] hover:bg-[#e8953a] text-white"
                  onClick={handleRecordPayment}
                  disabled={recordingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                >
                  {recordingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Sale Dialog */}
      <Dialog open={showReportSale} onOpenChange={setShowReportSale}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {reportStep === 'property' ? 'Select Property' : 'Report Sale'}
            </DialogTitle>
            <DialogDescription>
              {reportStep === 'property'
                ? 'Choose a property to report a sale for'
                : `Reporting sale for: ${reportSelectedProperty?.title}`}
            </DialogDescription>
          </DialogHeader>

          {reportStep === 'property' ? (
            <div className="space-y-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  className="pl-9"
                  value={reportPropertySearch}
                  onChange={(e) => setReportPropertySearch(e.target.value)}
                />
              </div>
              {reportPropertiesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {reportProperties
                    .filter(p => (p.title || '').toLowerCase().includes(reportPropertySearch.toLowerCase()) || (p.address || '').toLowerCase().includes(reportPropertySearch.toLowerCase()))
                    .map((property) => {
                      const isAvailable = property.status === 'AVAILABLE' || property.status === 'LISTED' || property.isListed;
                      const Icon = property.type === 'LAND' ? LandPlot : property.type === 'COMMERCIAL' ? Building2 : Home;
                      return (
                        <button
                          key={property.id}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border text-left hover:border-primary hover:bg-primary/5 transition-colors"
                          onClick={() => selectReportProperty(property)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{property.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{property.address}{property.city ? `, ${property.city}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-primary">{formatCurrency(Number(property.price))}</p>
                            <Badge variant={isAvailable ? 'success' : 'secondary'} className="text-[10px]">
                              {isAvailable ? 'Available' : property.status}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  {reportProperties.filter(p => (p.title || '').toLowerCase().includes(reportPropertySearch.toLowerCase())).length === 0 && !reportPropertiesLoading && (
                    <p className="text-center text-muted-foreground py-6 text-sm">No properties found</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-5 py-2">
              {/* Back button */}
              <button
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
                onClick={() => setReportStep('property')}
              >
                <ChevronLeft className="w-4 h-4" /> Back to property selection
              </button>

              {/* Property summary */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold text-sm">{reportSelectedProperty?.title}</p>
                    <p className="text-xs text-muted-foreground">{reportSelectedProperty?.type} · {formatCurrency(Number(reportSelectedProperty?.price))}</p>
                  </div>
                </div>
              </div>

              {/* Sale Attribution */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Sale Attribution *</h4>
                <div className="flex gap-2">
                  {(['REALTOR', 'COMPANY'] as const).map((attr) => (
                    <button
                      key={attr}
                      type="button"
                      onClick={() => setReportAttribution(attr)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                        reportAttribution === attr
                          ? attr === 'REALTOR' ? 'border-primary bg-primary/10 text-primary' : 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {attr === 'REALTOR' ? 'Assign to Realtor' : 'Company Sale'}
                    </button>
                  ))}
                </div>
                {reportAttribution === 'REALTOR' ? (
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={reportSelectedRealtorId}
                    onChange={(e) => setReportSelectedRealtorId(e.target.value)}
                  >
                    <option value="">— Select a realtor —</option>
                    {reportRealtors.map((r) => (
                      <option key={r.id} value={r.id}>{r.user.firstName} {r.user.lastName}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    No commission or loyalty points will be awarded on company sales.
                  </div>
                )}
              </div>

              {/* Buyer Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><User className="w-4 h-4" /> Buyer Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>First Name *</Label>
                    <Input placeholder="First name" value={reportForm.buyerFirstName} onChange={(e) => updateReportForm('buyerFirstName', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name *</Label>
                    <Input placeholder="Last name" value={reportForm.buyerLastName} onChange={(e) => updateReportForm('buyerLastName', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="buyer@email.com" value={reportForm.buyerEmail} onChange={(e) => updateReportForm('buyerEmail', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input placeholder="+234 xxx xxx xxxx" value={reportForm.buyerPhone} onChange={(e) => updateReportForm('buyerPhone', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Sale Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><NairaSign className="w-4 h-4" /> Sale Details</h4>

                <div className="space-y-1">
                  <Label>Date of Sale *</Label>
                  <Input type="date" max={new Date().toISOString().split('T')[0]} value={reportForm.saleDate} onChange={(e) => updateReportForm('saleDate', e.target.value)} />
                </div>

                {/* Payment Plan */}
                <div className="space-y-1">
                  <Label>Payment Plan</Label>
                  <div className="flex gap-2">
                    {(['FULL', 'INSTALLMENT'] as const).map((plan) => (
                      <button key={plan} type="button" onClick={() => updateReportForm('paymentPlan', plan)}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          reportForm.paymentPlan === plan
                            ? plan === 'FULL' ? 'border-primary bg-primary/10 text-primary' : 'border-[#fca639] bg-[#fca639]/10 text-[#fca639]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {plan === 'FULL' ? 'Full Payment' : 'Installment'}
                      </button>
                    ))}
                  </div>
                </div>

                {reportForm.paymentPlan === 'INSTALLMENT' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#fca639]/5 border border-[#fca639]/20 rounded-lg">
                    <div className="space-y-1">
                      <Label>Number of Installments</Label>
                      <Input type="number" min="2" max="24" value={reportForm.numberOfInstallments} onChange={(e) => updateReportForm('numberOfInstallments', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>First Payment (₦)</Label>
                      <Input type="number" placeholder="First installment amount" value={reportForm.firstPaymentAmount} onChange={(e) => updateReportForm('firstPaymentAmount', e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Size Sold ({AREA_UNITS[reportAreaUnit].shortLabel})</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={reportForm.sqmSold} onChange={(e) => updateReportForm('sqmSold', e.target.value)} className="flex-1" />
                      <AreaUnitSelect value={reportAreaUnit} onChange={handleReportAreaUnitChange} />
                    </div>
                  </div>
                  {reportSelectedProperty?.type === 'LAND' ? (
                    <div className="space-y-1">
                      <Label>Price per Plot (₦)</Label>
                      <Input type="number" value={reportForm.pricePerSqm} onChange={(e) => updateReportForm('pricePerSqm', e.target.value)} />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label>Payment Method</Label>
                      <select className="w-full px-3 py-2 border rounded-md text-sm" value={reportForm.paymentMethod} onChange={(e) => updateReportForm('paymentMethod', e.target.value)}>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="MORTGAGE">Mortgage</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Total Sale Amount (₦) *</Label>
                    {reportSelectedProperty?.type === 'LAND' ? (
                      <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-md text-lg font-bold text-primary">
                        {formatCurrency(parseFloat(reportForm.totalAmount) || 0)}
                      </div>
                    ) : (
                      <Input type="number" value={reportForm.totalAmount} onChange={(e) => updateReportForm('totalAmount', e.target.value)} />
                    )}
                  </div>
                  {reportSelectedProperty?.type === 'LAND' && (
                    <div className="space-y-1">
                      <Label>Payment Method</Label>
                      <select className="w-full px-3 py-2 border rounded-md text-sm" value={reportForm.paymentMethod} onChange={(e) => updateReportForm('paymentMethod', e.target.value)}>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="MORTGAGE">Mortgage</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Notes (Optional)</Label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md min-h-16 resize-none text-sm"
                    placeholder="Any additional notes..."
                    value={reportForm.notes}
                    onChange={(e) => updateReportForm('notes', e.target.value)}
                  />
                </div>

                {/* Summary */}
                <div className="p-3 bg-[#fca639]/10 border border-[#fca639]/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <p className="text-muted-foreground">{reportSelectedProperty?.title}</p>
                      <p className="text-muted-foreground">Buyer: {reportForm.buyerFirstName} {reportForm.buyerLastName}</p>
                      <p className="text-muted-foreground">
                        Credited to:{' '}
                        {reportAttribution === 'COMPANY' ? 'Company' : reportSelectedRealtorId
                          ? `${reportRealtors.find(r => r.id === reportSelectedRealtorId)?.user.firstName} ${reportRealtors.find(r => r.id === reportSelectedRealtorId)?.user.lastName}`
                          : '—'}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-primary">{formatCurrency(parseFloat(reportForm.totalAmount) || 0)}</p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReportSale(false)}>Cancel</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={handleSubmitReportSale} disabled={reportSubmitting}>
                  {reportSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Submit Sale Report
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <ReceiptModal
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        data={receiptData}
        branding={branding}
      />
    </div>
  );
}
