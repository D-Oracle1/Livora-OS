'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  Users,
  DollarSign,
  FileText,
  Search,
  Loader2,
  RefreshCw,
  CreditCard,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';

interface PayrollRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
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
  payDate: string | null;
  paidAt: string | null;
  approvedAt: string | null;
  staffProfile: {
    id: string;
    position: string | null;
    user: { firstName: string; lastName: string; avatar: string | null };
    department: { name: string } | null;
  };
}

interface Department {
  id: string;
  name: string;
}

interface PayrollSummary {
  totalRecords: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalTax: number;
  totalPension: number;
  byStatus: Record<string, number>;
  byDepartment: Record<string, { count: number; total: number }>;
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

const toNumber = (value: number | string): number => {
  return typeof value === 'string' ? parseFloat(value) : value;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="secondary">Draft</Badge>;
    case 'PENDING_APPROVAL':
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pending Approval</Badge>;
    case 'APPROVED':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Approved</Badge>;
    case 'PAID':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Paid</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// Get default period dates (current month)
const getDefaultPeriod = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

export default function AdminPayrollPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodStart, setPeriodStart] = useState(getDefaultPeriod().start);
  const [periodEnd, setPeriodEnd] = useState(getDefaultPeriod().end);

  // Payroll settings (pension / tax toggles)
  const [payrollSettings, setPayrollSettings] = useState({
    enablePension: true,
    pensionRate: 8,
    enableTax: true,
    taxRate: 7.5,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generatePeriodStart, setGeneratePeriodStart] = useState(getDefaultPeriod().start);
  const [generatePeriodEnd, setGeneratePeriodEnd] = useState(getDefaultPeriod().end);

  const fetchPayrollSettings = useCallback(async () => {
    try {
      const res: any = await api.get('/settings/payroll');
      const data = res?.data ?? res;
      if (data) {
        setPayrollSettings({
          enablePension: data.enablePension ?? true,
          pensionRate: (data.pensionRate ?? 0.08) * 100,
          enableTax: data.enableTax ?? true,
          taxRate: (data.taxRate ?? 0.075) * 100,
        });
      }
    } catch {
      // use defaults
    }
  }, []);

  const savePayrollSettings = async () => {
    setSettingsSaving(true);
    try {
      await api.put('/settings/payroll', {
        enablePension: payrollSettings.enablePension,
        pensionRate: payrollSettings.pensionRate / 100,
        enableTax: payrollSettings.enableTax,
        taxRate: payrollSettings.taxRate / 100,
      });
      toast.success('Payroll settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (departmentFilter !== 'all') params.append('departmentId', departmentFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (periodStart) params.append('periodStart', periodStart);
      if (periodEnd) params.append('periodEnd', periodEnd);

      const summaryParams = new URLSearchParams();
      summaryParams.append('periodStart', periodStart);
      summaryParams.append('periodEnd', periodEnd);
      if (departmentFilter !== 'all') summaryParams.append('departmentId', departmentFilter);

      const [payrollRes, deptRes, summaryRes] = await Promise.allSettled([
        api.get<any>(`/hr/payroll?${params.toString()}`),
        api.get<any>('/departments'),
        api.get<any>(`/hr/payroll/summary?${summaryParams.toString()}`),
      ]);

      if (payrollRes.status === 'fulfilled') {
        const data = payrollRes.value?.data?.data || payrollRes.value?.data || [];
        setPayrollRecords(Array.isArray(data) ? data : []);
      }

      if (deptRes.status === 'fulfilled') {
        const raw = deptRes.value?.data?.data ?? deptRes.value?.data ?? deptRes.value ?? [];
        setDepartments(Array.isArray(raw) ? raw : []);
      }

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value?.data || summaryRes.value || null);
      }
    } catch (err: any) {
      console.error('Failed to fetch payroll:', err);
      toast.error(err.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, statusFilter, periodStart, periodEnd]);

  useEffect(() => {
    fetchData();
    fetchPayrollSettings();
  }, [fetchData, fetchPayrollSettings]);

  const handleGenerate = async () => {
    setActionLoading('generate');
    try {
      const res: any = await api.post('/hr/payroll/generate', {
        periodStart: generatePeriodStart,
        periodEnd: generatePeriodEnd,
      });
      const generated = res?.data?.generated || res?.generated || 0;
      toast.success(`Generated payroll for ${generated} staff members`);
      setGenerateDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate payroll');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (record: PayrollRecord) => {
    setActionLoading(record.id);
    try {
      await api.put(`/hr/payroll/${record.id}/approve`, {});
      toast.success('Payroll approved');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve payroll');
    } finally {
      setActionLoading(null);
    }
  };

  const downloadPeriodReport = (period: { period: string; records: PayrollRecord[]; totalGross: number; totalDeductions: number; totalNet: number; staffCount: number }) => {
    const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
    const rows = period.records.map((r) =>
      `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${r.staffProfile?.user?.firstName || ''} ${r.staffProfile?.user?.lastName || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${r.staffProfile?.department?.name || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(toNumber(r.grossPay))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626">${fmt(toNumber(r.totalDeductions))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold">${fmt(toNumber(r.netPay))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${r.status}</td>
      </tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Payroll Report - ${period.period}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:40px}h1{font-size:20px;color:#1e40af;margin-bottom:4px}.subtitle{color:#666;font-size:12px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f8fafc;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb}th:nth-child(n+3){text-align:right}.summary{display:flex;gap:16px;margin:20px 0}.summary-card{flex:1;background:#f8fafc;border-radius:8px;padding:14px}.summary-card p{font-size:11px;color:#666;margin-bottom:4px}.summary-card .val{font-size:16px;font-weight:bold}@media print{body{padding:20px}}</style>
    </head><body>
    <h1>Payroll Report</h1><div class="subtitle">${period.period} &nbsp;·&nbsp; ${period.staffCount} staff</div>
    <div class="summary">
      <div class="summary-card"><p>Total Gross</p><div class="val">${fmt(period.totalGross)}</div></div>
      <div class="summary-card"><p>Total Deductions</p><div class="val" style="color:#dc2626">${fmt(period.totalDeductions)}</div></div>
      <div class="summary-card"><p>Total Net Pay</p><div class="val" style="color:#1e40af">${fmt(period.totalNet)}</div></div>
    </div>
    <table><thead><tr><th>Name</th><th>Department</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th style="text-align:center">Status</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked — please allow pop-ups'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const handleMarkPaid = async (record: PayrollRecord) => {
    setActionLoading(record.id);
    try {
      await api.put(`/hr/payroll/${record.id}/paid`, {});
      toast.success('Payroll marked as paid');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate stats from summary
  const stats = summary
    ? [
        { label: 'Total Payroll', value: formatCurrency(summary.totalNetPay), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Staff Count', value: summary.totalRecords.toString(), icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Avg. Salary', value: formatCurrency(summary.totalRecords > 0 ? summary.totalNetPay / summary.totalRecords : 0), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-100' },
        { label: 'Pending Approval', value: (summary.byStatus?.DRAFT || 0) + (summary.byStatus?.PENDING_APPROVAL || 0), icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
      ]
    : [
        { label: 'Total Payroll', value: formatCurrency(0), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Staff Count', value: '0', icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Avg. Salary', value: formatCurrency(0), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-100' },
        { label: 'Pending Approval', value: '0', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
      ];

  // Group payroll by period for history view
  const groupedByPeriod = payrollRecords.reduce((acc, record) => {
    const periodKey = formatPeriod(record.periodStart, record.periodEnd);
    if (!acc[periodKey]) {
      acc[periodKey] = {
        period: periodKey,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        records: [],
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        staffCount: 0,
        statuses: new Set<string>(),
      };
    }
    acc[periodKey].records.push(record);
    acc[periodKey].totalGross += toNumber(record.grossPay);
    acc[periodKey].totalDeductions += toNumber(record.totalDeductions);
    acc[periodKey].totalNet += toNumber(record.netPay);
    acc[periodKey].staffCount++;
    acc[periodKey].statuses.add(record.status);
    return acc;
  }, {} as Record<string, { period: string; periodStart: string; periodEnd: string; records: PayrollRecord[]; totalGross: number; totalDeductions: number; totalNet: number; staffCount: number; statuses: Set<string> }>);

  const periodSummaries = Object.values(groupedByPeriod).sort(
    (a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()
  );

  // Get overall status for a period
  const getPeriodStatus = (statuses: Set<string>) => {
    if (statuses.has('DRAFT') || statuses.has('PENDING_APPROVAL')) {
      return 'PENDING_APPROVAL';
    }
    if (statuses.has('APPROVED') && !statuses.has('PAID')) {
      return 'APPROVED';
    }
    if (statuses.size === 1 && statuses.has('PAID')) {
      return 'PAID';
    }
    return 'MIXED';
  };

  // Filter by search (staff name)
  const filteredRecords = payrollRecords.filter((record) => {
    if (!searchQuery) return true;
    const name = `${record.staffProfile?.user?.firstName || ''} ${record.staffProfile?.user?.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // Get current period records for staff breakdown
  const currentPeriodRecords = periodSummaries.length > 0 ? periodSummaries[0].records : [];
  const currentPeriodLabel = periodSummaries.length > 0 ? periodSummaries[0].period : formatPeriod(periodStart, periodEnd);

  // Filter current period records by search
  const filteredCurrentPeriod = currentPeriodRecords.filter((record) => {
    if (!searchQuery) return true;
    const name = `${record.staffProfile?.user?.firstName || ''} ${record.staffProfile?.user?.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (loading && payrollRecords.length === 0) {
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
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">Process payroll and manage staff compensation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setGenerateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Generate Payroll
          </Button>
        </div>
      </div>

      {/* Period Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2 items-center">
          <Label className="whitespace-nowrap">Period:</Label>
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full sm:w-[160px]"
          />
          <span>to</span>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full sm:w-[160px]"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Payroll History by Period */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Payroll History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {periodSummaries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No payroll records</p>
                <p className="text-sm">Generate payroll for the selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Gross Total</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodSummaries.map((period) => {
                    const status = getPeriodStatus(period.statuses);
                    const canApprove = period.statuses.has('DRAFT') || period.statuses.has('PENDING_APPROVAL');
                    const canMarkPaid = period.statuses.has('APPROVED') && !period.statuses.has('DRAFT') && !period.statuses.has('PENDING_APPROVAL');

                    return (
                      <TableRow key={period.period}>
                        <TableCell className="font-medium">{period.period}</TableCell>
                        <TableCell>{period.staffCount}</TableCell>
                        <TableCell>{formatCurrency(period.totalGross)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(period.totalDeductions)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(period.totalNet)}</TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell className="text-right">
                          {canApprove && (
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                // Approve all records for this period
                                const recordsToApprove = period.records.filter(
                                  (r) => r.status === 'DRAFT' || r.status === 'PENDING_APPROVAL'
                                );
                                recordsToApprove.forEach((r) => handleApprove(r));
                              }}
                              disabled={actionLoading !== null}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve All
                            </Button>
                          )}
                          {canMarkPaid && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                // Mark all approved records as paid
                                const recordsToMark = period.records.filter((r) => r.status === 'APPROVED');
                                recordsToMark.forEach((r) => handleMarkPaid(r));
                              }}
                              disabled={actionLoading !== null}
                            >
                              <CreditCard className="w-4 h-4" />
                              Mark Paid
                            </Button>
                          )}
                          {status === 'PAID' && (
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => downloadPeriodReport(period)}>
                              <Download className="w-4 h-4" />
                              Download
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Individual Payroll - Current Period */}
      {currentPeriodRecords.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  {currentPeriodLabel} - Staff Breakdown
                  <Badge variant="secondary">{filteredCurrentPeriod.length}</Badge>
                </CardTitle>
                <div className="relative w-full sm:w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredCurrentPeriod.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No staff found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCurrentPeriod.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              {record.staffProfile?.user?.avatar && (
                                <AvatarImage src={getImageUrl(record.staffProfile.user.avatar)} />
                              )}
                              <AvatarFallback className="bg-primary text-white text-xs">
                                {record.staffProfile?.user?.firstName?.[0] || ''}
                                {record.staffProfile?.user?.lastName?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {record.staffProfile?.user?.firstName} {record.staffProfile?.user?.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{record.staffProfile?.department?.name || '-'}</TableCell>
                        <TableCell>{record.staffProfile?.position || '-'}</TableCell>
                        <TableCell>{formatCurrency(record.grossPay, record.currency)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(record.totalDeductions, record.currency)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(record.netPay, record.currency)}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="text-right">
                          {(record.status === 'DRAFT' || record.status === 'PENDING_APPROVAL') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleApprove(record)}
                              disabled={actionLoading === record.id}
                            >
                              {actionLoading === record.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Approve
                            </Button>
                          )}
                          {record.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleMarkPaid(record)}
                              disabled={actionLoading === record.id}
                            >
                              {actionLoading === record.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CreditCard className="w-4 h-4" />
                              )}
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payroll Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Payroll Deduction Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Tax */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">PAYE Tax</p>
                    <p className="text-xs text-muted-foreground">Deduct income tax from payroll</p>
                  </div>
                  <Switch
                    checked={payrollSettings.enableTax}
                    onCheckedChange={(v) => setPayrollSettings((s) => ({ ...s, enableTax: v }))}
                  />
                </div>
                {payrollSettings.enableTax && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tax Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={payrollSettings.taxRate}
                      onChange={(e) => setPayrollSettings((s) => ({ ...s, taxRate: Number(e.target.value) }))}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>
              {/* Pension */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pension</p>
                    <p className="text-xs text-muted-foreground">Deduct pension contribution</p>
                  </div>
                  <Switch
                    checked={payrollSettings.enablePension}
                    onCheckedChange={(v) => setPayrollSettings((s) => ({ ...s, enablePension: v }))}
                  />
                </div>
                {payrollSettings.enablePension && (
                  <div className="space-y-1">
                    <Label className="text-xs">Pension Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={payrollSettings.pensionRate}
                      onChange={(e) => setPayrollSettings((s) => ({ ...s, pensionRate: Number(e.target.value) }))}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={savePayrollSettings} disabled={settingsSaving} className="gap-2">
                {settingsSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These settings apply when generating new payroll. Existing records are not affected.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Generate Payroll Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
            <DialogDescription>
              Generate payroll records for all active staff members for the specified period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="gen-start">Period Start</Label>
              <Input
                id="gen-start"
                type="date"
                value={generatePeriodStart}
                onChange={(e) => setGeneratePeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gen-end">Period End</Label>
              <Input
                id="gen-end"
                type="date"
                value={generatePeriodEnd}
                onChange={(e) => setGeneratePeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={actionLoading === 'generate'}
              className="gap-2"
            >
              {actionLoading === 'generate' && <Loader2 className="w-4 h-4 animate-spin" />}
              <Plus className="w-4 h-4" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
