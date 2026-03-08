'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  ArrowRight, Receipt, Tag, BarChart3, BookOpen, Clock,
  Percent, Scale, Waves, Lightbulb, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type TrendWindow = 1 | 3 | 6 | 12;

const TREND_WINDOWS: { label: string; value: TrendWindow }[] = [
  { label: '1M', value: 1 },
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
];

const SEVERITY_CONFIG = {
  CRITICAL: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', badge: 'bg-red-100 text-red-700' },
  WARNING:  { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
  INFO:     { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', badge: 'bg-blue-100 text-blue-700' },
};

const INSIGHT_CONFIG = {
  POSITIVE: { color: 'text-emerald-700', dot: 'bg-emerald-400' },
  NEGATIVE: { color: 'text-red-700',     dot: 'bg-red-400' },
  WARNING:  { color: 'text-amber-700',   dot: 'bg-amber-400' },
  INFO:     { color: 'text-blue-700',    dot: 'bg-blue-400' },
  NEUTRAL:  { color: 'text-gray-700',    dot: 'bg-gray-400' },
};

export default function AccountingOverviewPage() {
  const [summary, setSummary]           = useState<any>(null);
  const [trend, setTrend]               = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [anomalies, setAnomalies]       = useState<any[]>([]);
  const [insights, setInsights]         = useState<any[]>([]);
  const [trendWindow, setTrendWindow]   = useState<TrendWindow>(6);
  const [loading, setLoading]           = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchCore = useCallback(async () => {
    try {
      const [sumRaw, expRaw, anomRaw, insRaw] = await Promise.all([
        api.get<any>('/accounting/summary'),
        api.get<any>('/expenses?limit=5'),
        api.get<any>('/accounting/anomalies').catch(() => null),
        api.get<any>('/accounting/insights').catch(() => null),
      ]);
      setSummary(sumRaw?.data ?? sumRaw);
      // TransformInterceptor: { success, data: [...], meta: {} }
      setRecentExpenses(Array.isArray(expRaw?.data) ? expRaw.data : []);
      setAnomalies(anomRaw?.data?.anomalies ?? anomRaw?.anomalies ?? []);
      setInsights(insRaw?.data?.insights ?? insRaw?.insights ?? []);
    } catch {
      // silently fail — UI shows zeros
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrend = useCallback(async (months: TrendWindow) => {
    setTrendLoading(true);
    try {
      const raw = await api.get<any>(`/accounting/trend?months=${months}`);
      setTrend(Array.isArray(raw?.data ?? raw) ? (raw?.data ?? raw) : []);
    } catch {
      setTrend([]);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => { fetchCore(); }, [fetchCore]);
  useEffect(() => { fetchTrend(trendWindow); }, [fetchTrend, trendWindow]);

  const mtd = summary?.mtd;
  const ytd = summary?.ytd;

  const statCards = [
    {
      label: 'Revenue (MTD)',
      value: formatCurrency(mtd?.totalRevenue ?? 0),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Expenses (MTD)',
      value: formatCurrency(mtd?.totalExpenses ?? 0),
      icon: Receipt,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Commission (MTD)',
      value: formatCurrency(mtd?.totalCommission ?? 0),
      icon: Percent,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Taxes (MTD)',
      value: formatCurrency(mtd?.totalTax ?? 0),
      icon: Scale,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Net Profit (MTD)',
      value: formatCurrency(mtd?.netProfit ?? 0),
      icon: (mtd?.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown,
      color: (mtd?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: (mtd?.netProfit ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
  ];

  const quickLinks = [
    { href: '/dashboard/admin/accounting/expenses',    label: 'Expenses',      icon: Receipt,   desc: 'Add and track expenses' },
    { href: '/dashboard/admin/accounting/profit-loss', label: 'Profit & Loss', icon: TrendingUp, desc: 'Generate P&L statements' },
    { href: '/dashboard/admin/accounting/balance-sheet', label: 'Balance Sheet', icon: Scale,   desc: 'Assets, liabilities & equity' },
    { href: '/dashboard/admin/accounting/cash-flow',   label: 'Cash Flow',     icon: Waves,     desc: 'Money in vs money out' },
    { href: '/dashboard/admin/accounting/reports',     label: 'Reports',       icon: BarChart3, desc: 'Revenue trends and charts' },
    { href: '/dashboard/admin/accounting/categories',  label: 'Categories',    icon: Tag,       desc: 'Organise expense categories' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide financial summary</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchCore(); fetchTrend(trendWindow); }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Link href="/dashboard/admin/accounting/expenses">
            <Button size="sm" className="gap-2">
              <Receipt className="w-4 h-4" /> Add Expense
            </Button>
          </Link>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {!loading && anomalies.length > 0 && (
        <div className="space-y-2">
          {anomalies.map((a: any, i: number) => {
            const cfg = SEVERITY_CONFIG[a.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.INFO;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg}`}>
                <ShieldAlert className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.icon}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{a.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{a.severity}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{a.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stat Cards — 5 metrics */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-5"><div className="h-14 bg-gray-100 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{card.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1 truncate">{card.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${card.bg} ml-2 flex-shrink-0`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses Chart with period selector */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
              <div className="flex gap-1">
                {TREND_WINDOWS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setTrendWindow(w.value)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      trendWindow === w.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <div className="h-[220px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trend.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="revenue"   name="Revenue"   fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses"  name="Expenses"  fill="#f87171" radius={[3, 3, 0, 0]} />
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
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <>
                {[
                  { label: 'Total Revenue',    value: ytd?.totalRevenue ?? 0,    color: 'text-green-600' },
                  { label: 'Commissions Paid', value: ytd?.totalCommission ?? 0, color: 'text-blue-600' },
                  { label: 'Taxes Collected',  value: ytd?.totalTax ?? 0,        color: 'text-purple-600' },
                  { label: 'Total Expenses',   value: ytd?.totalExpenses ?? 0,   color: 'text-red-600' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" /> Financial Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : insights.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Insights will appear once financial data is recorded</p>
            ) : (
              <ul className="space-y-3">
                {insights.map((ins: any, i: number) => {
                  const cfg = INSIGHT_CONFIG[ins.type as keyof typeof INSIGHT_CONFIG] ?? INSIGHT_CONFIG.NEUTRAL;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                      <span className={`text-sm ${cfg.color}`}>{ins.message}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Recent Expenses
            </CardTitle>
            <Link href="/dashboard/admin/accounting/expenses">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">View all <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No expenses recorded yet</p>
            ) : (
              <div className="space-y-2">
                {recentExpenses.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{exp.title}</p>
                      <p className="text-xs text-gray-500">{exp.category?.name} · {formatDate(exp.expenseDate)}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 ml-2 flex-shrink-0">{formatCurrency(Number(exp.amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links — 6 tiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" /> Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer group text-center">
                  <link.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 mb-2 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">{link.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-tight">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
