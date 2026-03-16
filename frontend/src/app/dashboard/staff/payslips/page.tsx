'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Download,
  Calendar,
  TrendingUp,
  Loader2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';

interface PayrollRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string | null;
  baseSalary: number | string;
  overtime: number | string;
  bonus: number | string;
  allowances: { [key: string]: number } | null;
  grossPay: number | string;
  tax: number | string;
  pension: number | string;
  otherDeductions: { [key: string]: number } | null;
  totalDeductions: number | string;
  netPay: number | string;
  currency: string;
  status: string;
  paidAt: string | null;
}

const formatCurrency = (amount: number | string, currency: string = 'NGN') => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
};

const formatPeriod = (start: string, end: string) => {
  const endDate = new Date(end);
  return endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PAID':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Paid</Badge>;
    case 'APPROVED':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Approved</Badge>;
    case 'PENDING':
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</Badge>;
    case 'DRAFT':
      return <Badge variant="secondary">Draft</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const toNumber = (value: number | string): number => {
  return typeof value === 'string' ? parseFloat(value) : value;
};

const downloadPayslip = (payslip: PayrollRecord) => {
  const period = formatPeriod(payslip.periodStart, payslip.periodEnd);
  const gross = toNumber(payslip.grossPay);
  const net = toNumber(payslip.netPay);
  const tax = toNumber(payslip.tax);
  const pension = toNumber(payslip.pension);
  const base = toNumber(payslip.baseSalary);
  const overtime = toNumber(payslip.overtime);
  const bonus = toNumber(payslip.bonus);
  const totalDeductions = toNumber(payslip.totalDeductions);
  const currency = payslip.currency || 'NGN';

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n);

  // Build allowance rows
  const allowanceRows = payslip.allowances
    ? Object.entries(payslip.allowances)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</td><td style="text-align:right;color:#16a34a">${fmt(v)}</td></tr>`)
        .join('')
    : '';

  const otherDeductionRows = payslip.otherDeductions
    ? Object.entries(payslip.otherDeductions)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</td><td style="text-align:right;color:#dc2626">-${fmt(v)}</td></tr>`)
        .join('')
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip - ${period}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 40px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 22px; color: #1e40af; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge.approved { background: #dbeafe; color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; color: #666; font-size: 11px; text-transform: uppercase; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    th:last-child { text-align: right; }
    td { padding: 8px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    td:last-child { text-align: right; }
    .total-row td { font-weight: bold; border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 12px; font-size: 14px; }
    .net-box { background: #1e40af; color: white; padding: 20px 24px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
    .net-box p { font-size: 12px; opacity: 0.8; margin-bottom: 4px; }
    .net-box .amount { font-size: 24px; font-weight: bold; }
    .net-box .right { text-align: right; font-size: 12px; opacity: 0.9; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Payslip</h1>
      <div class="subtitle">${period}</div>
      <span class="badge ${payslip.status === 'PAID' ? '' : 'approved'}">${payslip.status}</span>
    </div>
    <div style="text-align:right;color:#666;font-size:12px;">
      ${payslip.payDate ? `<div>Pay Date: <strong>${formatDate(payslip.payDate)}</strong></div>` : ''}
      ${payslip.paidAt ? `<div>Paid At: <strong>${formatDate(payslip.paidAt)}</strong></div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>Earnings</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">Base Salary</td><td style="text-align:right;color:#16a34a">${fmt(base)}</td></tr>
      ${overtime > 0 ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">Overtime</td><td style="text-align:right;color:#16a34a">${fmt(overtime)}</td></tr>` : ''}
      ${bonus > 0 ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">Bonus</td><td style="text-align:right;color:#16a34a">${fmt(bonus)}</td></tr>` : ''}
      ${allowanceRows}
      <tr class="total-row"><td>Total Earnings</td><td style="color:#16a34a">${fmt(gross)}</td></tr>
    </tbody>
  </table>

  <table>
    <thead><tr><th>Deductions</th><th>Amount</th></tr></thead>
    <tbody>
      ${tax > 0 ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">Tax (PAYE)</td><td style="text-align:right;color:#dc2626">-${fmt(tax)}</td></tr>` : ''}
      ${pension > 0 ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">Pension</td><td style="text-align:right;color:#dc2626">-${fmt(pension)}</td></tr>` : ''}
      ${otherDeductionRows}
      <tr class="total-row"><td>Total Deductions</td><td style="color:#dc2626">-${fmt(totalDeductions)}</td></tr>
    </tbody>
  </table>

  <div class="net-box">
    <div>
      <p>Net Salary</p>
      <div class="amount">${fmt(net)}</div>
    </div>
    <div class="right">
      <div>Gross: ${fmt(gross)}</div>
      <div>Deductions: -${fmt(totalDeductions)}</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Pop-up blocked — please allow pop-ups to download payslip'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
};

export default function PayslipsPage() {
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/hr/payroll/my');
      const data = res?.data || res;
      setPayslips(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch payslips:', err);
      toast.error(err.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get the latest payslip for current month summary
  const latestPayslip = payslips.length > 0 ? payslips[0] : null;

  // Build earnings and deductions breakdown for latest payslip
  const buildBreakdown = (payslip: PayrollRecord | null) => {
    if (!payslip) return { earnings: [], deductions: [], totalEarnings: 0, totalDeductions: 0 };

    const earnings = [
      { label: 'Base Salary', amount: toNumber(payslip.baseSalary) },
    ];

    if (toNumber(payslip.overtime) > 0) {
      earnings.push({ label: 'Overtime', amount: toNumber(payslip.overtime) });
    }

    if (toNumber(payslip.bonus) > 0) {
      earnings.push({ label: 'Bonus', amount: toNumber(payslip.bonus) });
    }

    // Add allowances from JSON field
    if (payslip.allowances && typeof payslip.allowances === 'object') {
      Object.entries(payslip.allowances).forEach(([key, value]) => {
        if (value && value > 0) {
          earnings.push({
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            amount: value,
          });
        }
      });
    }

    const deductions = [];

    if (toNumber(payslip.tax) > 0) {
      deductions.push({ label: 'Tax (PAYE)', amount: toNumber(payslip.tax) });
    }

    if (toNumber(payslip.pension) > 0) {
      deductions.push({ label: 'Pension', amount: toNumber(payslip.pension) });
    }

    // Add other deductions from JSON field
    if (payslip.otherDeductions && typeof payslip.otherDeductions === 'object') {
      Object.entries(payslip.otherDeductions).forEach(([key, value]) => {
        if (value && value > 0) {
          deductions.push({
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            amount: value,
          });
        }
      });
    }

    return {
      earnings,
      deductions,
      totalEarnings: toNumber(payslip.grossPay),
      totalDeductions: toNumber(payslip.totalDeductions),
    };
  };

  const breakdown = buildBreakdown(latestPayslip);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payslips</h1>
          <p className="text-muted-foreground">View your salary details and payment history</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {payslips.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No payslips yet</p>
            <p className="text-sm">Your salary information will appear here once processed</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Month Summary */}
          {latestPayslip && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-primary/20 border-2">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {formatPeriod(latestPayslip.periodStart, latestPayslip.periodEnd)}
                        </p>
                        <p className="text-3xl font-bold">
                          {formatCurrency(latestPayslip.netPay, latestPayslip.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">Net Salary</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(latestPayslip.status)}
                      {latestPayslip.payDate && (
                        <p className="text-sm text-muted-foreground">
                          {latestPayslip.status === 'PAID' ? 'Paid on' : 'Pay date:'} {formatDate(latestPayslip.payDate)}
                        </p>
                      )}
                      <Button variant="outline" className="gap-2" onClick={() => downloadPayslip(latestPayslip)}>
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Salary Breakdown */}
          {latestPayslip && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Earnings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-5 h-5" />
                      Earnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {breakdown.earnings.map((item) => (
                        <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                          <span className="text-sm">{item.label}</span>
                          <span className="font-medium text-green-600">
                            +{formatCurrency(item.amount, latestPayslip.currency)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 font-semibold">
                        <span>Total Earnings</span>
                        <span className="text-green-600">
                          {formatCurrency(breakdown.totalEarnings, latestPayslip.currency)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Deductions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <NairaSign className="w-5 h-5" />
                      Deductions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {breakdown.deductions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No deductions</p>
                      ) : (
                        breakdown.deductions.map((item) => (
                          <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                            <span className="text-sm">{item.label}</span>
                            <span className="font-medium text-red-600">
                              -{formatCurrency(item.amount, latestPayslip.currency)}
                            </span>
                          </div>
                        ))
                      )}
                      <div className="flex items-center justify-between pt-2 font-semibold">
                        <span>Total Deductions</span>
                        <span className="text-red-600">
                          {formatCurrency(breakdown.totalDeductions, latestPayslip.currency)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Net Salary Card */}
          {latestPayslip && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-primary text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-primary-foreground/80">
                        Net Salary for {formatPeriod(latestPayslip.periodStart, latestPayslip.periodEnd)}
                      </p>
                      <p className="text-4xl font-bold mt-2">
                        {formatCurrency(latestPayslip.netPay, latestPayslip.currency)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>Gross: {formatCurrency(latestPayslip.grossPay, latestPayslip.currency)}</p>
                      <p>Deductions: -{formatCurrency(latestPayslip.totalDeductions, latestPayslip.currency)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Payment History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Gross Salary</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((payslip) => (
                      <TableRow key={payslip.id}>
                        <TableCell className="font-medium">
                          {formatPeriod(payslip.periodStart, payslip.periodEnd)}
                        </TableCell>
                        <TableCell>{formatCurrency(payslip.grossPay, payslip.currency)}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payslip.netPay, payslip.currency)}
                        </TableCell>
                        <TableCell>{formatDate(payslip.payDate || payslip.paidAt)}</TableCell>
                        <TableCell>{getStatusBadge(payslip.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => downloadPayslip(payslip)}>
                            <Download className="w-4 h-4" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
