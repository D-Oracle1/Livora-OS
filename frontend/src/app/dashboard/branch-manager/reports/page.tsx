'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, ArrowDownRight, Loader2, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

export default function BranchReportsPage() {
  const [pl, setPl]           = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const user = getUser();

  const load = async () => {
    setLoading(true);
    try {
      const branchId = user?.branchId;
      const data = await api.get(`/accounting/branches/${branchId}/profit-loss?startDate=${startDate}&endDate=${endDate}`);
      setPl(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const plBarData = pl ? [
    { name: 'Gross Revenue',   value: pl.income?.grossRevenue ?? 0 },
    { name: 'Commission',      value: pl.costs?.commission ?? 0 },
    { name: 'Tax',             value: pl.costs?.tax ?? 0 },
    { name: 'Expenses',        value: pl.costs?.operationalExpenses ?? 0 },
    { name: 'Net Profit',      value: pl.netProfit ?? 0 },
  ] : [];

  const expensePieData = pl?.expenseBreakdown?.map((e: any) => ({
    name: e.category, value: e.amount,
  })) ?? [];

  const kpis = pl ? [
    { label: 'Gross Revenue',   value: fmt(pl.income?.grossRevenue ?? 0),        icon: DollarSign,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Total Costs',     value: fmt(pl.costs?.totalCosts ?? 0),            icon: ArrowDownRight, color: 'text-red-500',   bg: 'bg-red-50 dark:bg-red-950' },
    { label: 'Net Profit',      value: fmt(pl.netProfit ?? 0),                    icon: TrendingUp,    color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
    { label: 'Profit Margin',   value: pl.margin ?? '0%',                          icon: BarChart3,     color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950' },
  ] : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branch Reports</h1>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Run Report
        </Button>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Start Date</Label>
          <Input type="date" value={startDate} onChange={e => setStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">End Date</Label>
          <Input type="date" value={endDate} onChange={e => setEnd(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" onClick={load} disabled={loading}>Apply</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : !pl ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* P&L Bar Chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Profit & Loss Overview</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={plBarData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {plBarData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense Breakdown Pie */}
          {expensePieData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Expense Breakdown by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {expensePieData.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Expense detail table */}
          {expensePieData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Expense Detail</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500 text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Category</th>
                    <th className="text-right py-2 px-3 font-medium">Count</th>
                    <th className="text-right py-2 pl-3 font-medium">Amount</th>
                  </tr></thead>
                  <tbody>
                    {pl.expenseBreakdown.map((e: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{e.category}</td>
                        <td className="text-right px-3 text-gray-500">{e.count}</td>
                        <td className="text-right pl-3 font-medium text-red-500">{fmt(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
