'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  TrendingUp,
  Calendar,
  Building2,
  ArrowUpRight,
  FileText,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Square,
  Banknote,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate, formatArea } from '@/lib/utils';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

type SaleItem = {
  id: number | string;
  property: string;
  propertyType: string;
  buyer: string;
  buyerEmail: string;
  buyerPhone: string;
  amount: number;
  commission: number;
  plotsSold: number;
  sqmSold: number;
  date: string;
  status: string;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  numberOfInstallments: number;
  totalPaid: number;
  remainingBalance: number;
  payments: Array<{ number: number; amount: number; date: string; commission: number; method: string; reference: string }>;
  nextPaymentDue: string | null;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
    case 'IN_PROGRESS':
      return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
    case 'PENDING':
      return <Badge className="bg-orange-100 text-orange-700">Pending</Badge>;
    case 'CANCELLED':
      return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'IN_PROGRESS':
      return <Clock className="w-4 h-4 text-blue-600" />;
    case 'PENDING':
      return <Clock className="w-4 h-4 text-orange-600" />;
    case 'CANCELLED':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return null;
  }
};

export default function RealtorSalesPage() {
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [recordPaymentSale, setRecordPaymentSale] = useState<SaleItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [expandedSale, setExpandedSale] = useState<number | string | null>(null);
  const [salesData, setSalesData] = useState<SaleItem[]>([]);

  const fetchSales = useCallback(async () => {
    try {
      const response = await api.get<{ data: any[]; meta: any }>('/sales?page=1&limit=500');
      const mapped = response.data.map((s: any) => ({
        id: s.id as number | string,
        property: s.property?.title || 'Unknown Property',
        propertyType: s.property?.type || 'Residential',
        buyer: `${s.client?.user?.firstName || ''} ${s.client?.user?.lastName || ''}`.trim() || 'Unknown',
        buyerEmail: s.client?.user?.email || '',
        buyerPhone: s.client?.user?.phone || '',
        amount: Number(s.salePrice) || 0,
        commission: Number(s.commissionAmount) || 0,
        plotsSold: 1,
        sqmSold: Number(s.areaSold) || 0,
        date: s.saleDate ? new Date(s.saleDate).toISOString().split('T')[0] : '',
        status: s.status || 'PENDING',
        paymentPlan: (s.paymentPlan || 'FULL') as 'FULL' | 'INSTALLMENT',
        numberOfInstallments: s.numberOfInstallments || 1,
        totalPaid: Number(s.totalPaid) || 0,
        remainingBalance: Number(s.remainingBalance) || 0,
        payments: (s.payments || []).map((p: any) => ({
          number: p.paymentNumber || 0,
          amount: Number(p.amount) || 0,
          date: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '',
          commission: Number(p.commissionAmount) || 0,
          method: p.paymentMethod || '',
          reference: p.reference || '',
        })),
        nextPaymentDue: s.nextPaymentDue || null,
      }));
      setSalesData(mapped);
    } catch (err) {
      console.error('Failed to fetch sales:', err);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filterByTimePeriod = (date: string) => {
    const itemDate = new Date(date);
    const now = new Date();

    switch (timePeriod) {
      case 'month':
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return itemDate >= quarterStart && itemDate.getFullYear() === now.getFullYear();
      case 'year':
        return itemDate.getFullYear() === now.getFullYear();
      case 'all':
      default:
        return true;
    }
  };

  const filteredSales = useMemo(() => {
    return salesData.filter(sale => {
      const matchesSearch = sale.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           sale.buyer.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || sale.status === filterStatus;
      const matchesTime = filterByTimePeriod(sale.date);
      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [salesData, searchTerm, filterStatus, timePeriod]);

  const stats = useMemo(() => {
    const activeSales = filteredSales.filter(s => s.status === 'COMPLETED' || s.status === 'IN_PROGRESS');
    const totalCommission = activeSales.reduce((sum, s) => sum + s.commission, 0);
    const pendingCount = filteredSales.filter(s => s.status === 'PENDING').length;
    const inProgressCount = filteredSales.filter(s => s.status === 'IN_PROGRESS').length;

    return [
      { title: 'Total Reports', value: filteredSales.length.toString(), icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { title: 'Completed', value: activeSales.length.toString(), icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'In Progress', value: `${inProgressCount}`, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { title: 'My Commission', value: formatCurrency(totalCommission), icon: NairaSign, color: 'text-primary', bgColor: 'bg-primary/10' },
    ];
  }, [filteredSales]);

  const handleViewReceipt = (sale: SaleItem) => {
    const receiptData: ReceiptData = {
      receiptNumber: `ELNG-${new Date(sale.date || Date.now()).getFullYear().toString().slice(-2)}-${sale.id.toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      type: 'sale',
      date: sale.date,
      seller: {
        name: companyName,
        address: branding.address || '',
      },
      buyer: {
        name: sale.buyer,
        email: sale.buyerEmail,
        phone: sale.buyerPhone,
      },
      property: {
        name: sale.property,
        type: sale.propertyType,
        address: '',
      },
      description: (() => { const qty = sale.plotsSold > 0 ? sale.plotsSold : 1; const isLand = (sale.propertyType || 'Land') === 'Land'; const unit = isLand ? (qty === 1 ? 'plot' : 'plots') : (qty === 1 ? 'unit' : 'units'); return `Purchase of ${qty} ${unit} of ${sale.propertyType || 'Land'} lying and situate at ${sale.property}.`; })(),
      realtorName: undefined,
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
      status: sale.status === 'COMPLETED' ? 'completed' : sale.status === 'CANCELLED' ? 'cancelled' : sale.status === 'IN_PROGRESS' ? 'pending' : 'pending',
      ...(sale.paymentPlan === 'INSTALLMENT' ? {
        paymentHistory: sale.payments.map(p => ({
          number: p.number,
          amount: p.amount,
          date: p.date,
          method: p.method,
          reference: p.reference,
          commission: p.commission,
        })),
        totalPaid: sale.totalPaid,
        remainingBalance: sale.remainingBalance,
      } : {}),
    };
    setSelectedReceipt(receiptData);
    setReceiptModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ['Property', 'Type', 'Buyer', 'Phone', 'Plots', 'SQM', 'Amount', 'Commission', 'Date', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredSales.map(sale => [
        `"${sale.property}"`,
        sale.propertyType,
        `"${sale.buyer}"`,
        sale.buyerPhone,
        sale.plotsSold,
        sale.sqmSold,
        sale.amount,
        sale.commission,
        sale.date,
        sale.status,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Sales data exported successfully!');
  };

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  const getProgressBarColor = (sale: SaleItem) => {
    if (sale.remainingBalance <= 0) return 'bg-green-500';
    if (sale.nextPaymentDue && new Date(sale.nextPaymentDue) < new Date()) return 'bg-red-500';
    return 'bg-[#fca639]';
  };

  const getBadgeColor = (sale: SaleItem) => {
    if (sale.remainingBalance <= 0) return 'bg-green-100 text-green-700';
    if (sale.nextPaymentDue && new Date(sale.nextPaymentDue) < new Date()) return 'bg-red-100 text-red-700';
    return 'bg-[#fca639]/10 text-[#fca639]';
  };

  const getPaymentCounterText = (sale: SaleItem) => {
    if (sale.remainingBalance <= 0) return `${sale.payments.length}/${sale.payments.length} paid`;
    return `${sale.payments.length}/${sale.numberOfInstallments} paid`;
  };

  const handleRecordPayment = async () => {
    if (!recordPaymentSale || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > recordPaymentSale.remainingBalance) {
      toast.error('Invalid payment amount');
      return;
    }
    try {
      await api.post(`/sales/${recordPaymentSale.id}/payments`, {
        amount,
        paymentMethod,
      });
      await fetchSales();
      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully!`);
    } catch {
      // API unavailable, update locally as fallback
      const commissionRate = recordPaymentSale.commission / recordPaymentSale.amount;
      const paymentCommission = Math.round(amount * commissionRate);
      const newPayment = {
        number: recordPaymentSale.payments.length + 1,
        amount,
        date: new Date().toISOString().split('T')[0],
        commission: paymentCommission,
        method: paymentMethod,
        reference: '',
      };
      setSalesData(prev => prev.map(s =>
        s.id === recordPaymentSale.id
          ? {
              ...s,
              payments: [...s.payments, newPayment],
              totalPaid: s.totalPaid + amount,
              remainingBalance: s.remainingBalance - amount,
            }
          : s
      ));
      toast.success(`Payment of ${formatCurrency(amount)} recorded locally.`);
    }
    setShowRecordPayment(false);
    setRecordPaymentSale(null);
    setPaymentAmount('');
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
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Sales List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <NairaSign className="w-5 h-5 text-primary" />
              My Reported Sales
              <Badge variant="outline" className="ml-2">{getTimePeriodLabel()}</Badge>
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search sales..."
                  className="pl-9 w-full md:w-64"
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
                    <th className="pb-4 font-medium min-w-[200px]">Property</th>
                    <th className="pb-4 font-medium min-w-[130px]">Buyer</th>
                    <th className="pb-4 font-medium text-center min-w-[90px]">Qty Sold</th>
                    <th className="pb-4 font-medium text-right min-w-[120px]">Sale Amount</th>
                    <th className="pb-4 font-medium text-right min-w-[120px]">My Commission</th>
                    <th className="pb-4 font-medium text-center min-w-[120px]">Plan</th>
                    <th className="pb-4 font-medium text-center min-w-[90px]">Date</th>
                    <th className="pb-4 font-medium text-center min-w-[90px]">Status</th>
                    <th className="pb-4 font-medium text-center min-w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSales.map((sale) => (
                    <React.Fragment key={sale.id}>
                    <tr
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${sale.paymentPlan === 'INSTALLMENT' ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (sale.paymentPlan === 'INSTALLMENT') {
                          setExpandedSale(expandedSale === sale.id ? null : sale.id);
                        }
                      }}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{sale.property}</p>
                            <p className="text-xs text-muted-foreground">{sale.propertyType}</p>
                          </div>
                          {sale.paymentPlan === 'INSTALLMENT' && (
                            expandedSale === sale.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-sm font-medium">{sale.buyer}</p>
                        <p className="text-xs text-muted-foreground">{sale.buyerPhone}</p>
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
                      <td className="py-4 font-semibold text-right">{formatCurrency(sale.amount)}</td>
                      <td className="py-4 text-primary font-semibold text-right">{formatCurrency(sale.commission)}</td>
                      <td className="py-4 text-center">
                        {sale.paymentPlan === 'FULL' ? (
                          <Badge variant="outline" className="text-xs">Full</Badge>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Badge className={`${getBadgeColor(sale)} text-xs mb-1`}>
                              Installment {getPaymentCounterText(sale)}
                            </Badge>
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full mx-auto">
                              <div className={`h-full ${getProgressBarColor(sale)} rounded-full`} style={{ width: `${Math.min((sale.totalPaid / sale.amount) * 100, 100)}%` }} />
                            </div>
                            {sale.nextPaymentDue && new Date(sale.nextPaymentDue) < new Date() && sale.remainingBalance > 0 && (
                              <span className="text-[9px] text-red-600 font-medium mt-0.5">Overdue</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-muted-foreground text-center text-sm">{formatDate(sale.date)}</td>
                      <td className="py-4 text-center">{getStatusBadge(sale.status)}</td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleViewReceipt(sale); }}
                            disabled={sale.status !== 'COMPLETED'}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Receipt
                          </Button>
                          {sale.paymentPlan === 'INSTALLMENT' && sale.remainingBalance > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordPaymentSale(sale);
                                setPaymentAmount('');
                                setShowRecordPayment(true);
                              }}
                              className="text-[#fca639]"
                            >
                              <Banknote className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {sale.paymentPlan === 'INSTALLMENT' && expandedSale === sale.id && (
                      <tr className="bg-gray-50 dark:bg-gray-800/30">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="text-sm">
                            <p className="font-medium mb-2">Payment History</p>
                            <div className="space-y-2">
                              {sale.payments.length === 0 && (
                                <p className="text-muted-foreground text-center py-2">No payments recorded yet.</p>
                              )}
                              {sale.payments.map((p) => (
                                <div key={p.number} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                                  <span>Payment #{p.number}</span>
                                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(p.date)}</span>
                                  {p.method && <span className="text-xs text-muted-foreground">{p.method.replace('_', ' ')}</span>}
                                  <span className="text-xs text-primary">Commission: {formatCurrency(p.commission)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-2 pt-2 border-t text-sm">
                              <span>Total Paid: <strong>{formatCurrency(sale.totalPaid)}</strong></span>
                              <span>Remaining: <strong className="text-orange-600">{formatCurrency(sale.remainingBalance)}</strong></span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        No sales found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#fca639]" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          {recordPaymentSale && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="font-medium text-sm">{recordPaymentSale.property}</p>
                <p className="text-xs text-muted-foreground">
                  Remaining: {formatCurrency(recordPaymentSale.remainingBalance)} of {formatCurrency(recordPaymentSale.amount)}
                </p>
                <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-full bg-[#fca639] rounded-full"
                    style={{ width: `${(recordPaymentSale.totalPaid / recordPaymentSale.amount) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Amount (₦)</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRecordPayment(false)}>Cancel</Button>
                <Button
                  className="bg-[#fca639] hover:bg-[#e8953a] text-white"
                  onClick={handleRecordPayment}
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                >
                  Record Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
