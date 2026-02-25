'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  ArrowRight, Receipt, Tag, BarChart3, BookOpen, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Summary {
  mtd: { totalRevenue: number; totalCommission: number; totalTax: number; totalExpenses: number; netProfit: number };
  ytd: { totalRevenue: number; totalCommission: number; totalTax: number; totalExpenses: number; netProfit: number };
  pendingExpenses: { count: number; amount: number };
}

interface TrendPoint {
  month: string; year: number; revenue: number; expenses: number; netProfit: number;
}

export default function AccountingOverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sumRaw, trendRaw, expRaw] = await Promise.all([
        api.get<any>('/accounting/summary'),
        api.get<any>('/accounting/trend?months=6'),
        api.get<any>('/expenses?limit=5&approvalStatus=PENDING'),
      ]);
      setSummary(sumRaw?.data ?? sumRaw);
      setTrend(Array.isArray(trendRaw?.data ?? trendRaw) ? (trendRaw?.data ?? trendRaw) : []);
      const expData = expRaw?.data ?? expRaw;
      setRecentExpenses(Array.isArray(expData?.data) ? expData.data : []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mtd = summary?.mtd;
  const ytd = summary?.ytd;

  const statCards = [
    {
      label: 'Revenue (MTD)',
      value: formatCurrency(mtd?.totalRevenue ?? 0),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
      change: mtd?.totalRevenue ?? 0,
      positive: true,
    },
    {
      label: 'Expenses (MTD)',
      value: formatCurrency(mtd?.totalExpenses ?? 0),
      icon: Receipt,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Net Profit (MTD)',
      value: formatCurrency(mtd?.netProfit ?? 0),
      icon: (mtd?.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown,
      color: (mtd?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: (mtd?.netProfit ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Pending Approvals',
      value: `${summary?.pendingExpenses.count ?? 0} expenses`,
      subValue: formatCurrency(summary?.pendingExpenses.amount ?? 0),
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const quickLinks = [
    { href: '/dashboard/admin/accounting/expenses', label: 'Manage Expenses', icon: Receipt, desc: 'Add, approve, and track expenses' },
    { href: '/dashboard/admin/accounting/categories', label: 'Categories', icon: Tag, desc: 'Organize expense categories' },
    { href: '/dashboard/admin/accounting/profit-loss', label: 'Profit & Loss', icon: TrendingUp, desc: 'Generate P&L statements' },
    { href: '/dashboard/admin/accounting/reports', label: 'Reports & Charts', icon: BarChart3, desc: 'Revenue trends and breakdowns' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Financial summary and key metrics</p>
        </div>
        <Link href="/dashboard/admin/accounting/expenses">
          <Button className="gap-2">
            <Receipt className="w-4 h-4" /> Add Expense
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-gray-100 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                    {card.subValue && <p className="text-xs text-gray-500 mt-0.5">{card.subValue}</p>}
                  </div>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue vs Expenses (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="netProfit" name="Net Profit" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* YTD Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Year-to-Date Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Total Revenue', value: ytd?.totalRevenue ?? 0, color: 'text-green-600' },
              { label: 'Commissions Paid', value: ytd?.totalCommission ?? 0, color: 'text-blue-600' },
              { label: 'Taxes', value: ytd?.totalTax ?? 0, color: 'text-purple-600' },
              { label: 'Total Expenses', value: ytd?.totalExpenses ?? 0, color: 'text-red-600' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t-2 border-gray-200">
              <span className="text-sm font-semibold text-gray-900">Net Profit YTD</span>
              <span className={`text-base font-bold ${(ytd?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(ytd?.netProfit ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Expenses + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Pending Approvals
            </CardTitle>
            <Link href="/dashboard/admin/accounting/expenses?approvalStatus=PENDING">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">View all <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No pending expenses</p>
            ) : (
              <div className="space-y-3">
                {recentExpenses.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{exp.title}</p>
                      <p className="text-xs text-gray-500">{exp.category?.name} · {formatDate(exp.expenseDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(exp.amount))}</p>
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-white text-xs">Pending</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" /> Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer group">
                    <link.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 mb-2" />
                    <p className="text-sm font-medium text-gray-900">{link.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
