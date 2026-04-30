'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type ReportTab = 'trend' | 'breakdown' | 'revenue';
type TrendMonths = 6 | 12 | 24;

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#4a32af', '#06b6d4', '#f97316'];

function getThisYearRange() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export default function ReportsPage() {
  const branding = useBranding();
  const [tab, setTab] = useState<ReportTab>('trend');
  const [trendMonths, setTrendMonths] = useState<TrendMonths>(12);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customStart, setCustomStart] = useState(getThisYearRange().start);
  const [customEnd, setCustomEnd] = useState(getThisYearRange().end);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api.get<any>(`/accounting/trend?months=${trendMonths}`);
      setTrendData(Array.isArray(raw?.data ?? raw) ? (raw?.data ?? raw) : []);
    } catch { toast.error('Failed to load trend data'); }
    finally { setLoading(false); }
  }, [trendMonths]);

  const fetchBreakdown = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api.get<any>(`/accounting/expense-breakdown?startDate=${customStart}&endDate=${customEnd}`);
      setBreakdown(raw?.data ?? raw);
    } catch { toast.error('Failed to load breakdown'); }
    finally { setLoading(false); }
  }, [customStart, customEnd]);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api.get<any>(`/accounting/revenue?startDate=${customStart}&endDate=${customEnd}`);
      setRevenueData(raw?.data ?? raw);
    } catch { toast.error('Failed to load revenue data'); }
    finally { setLoading(false); }
  }, [customStart, customEnd]);

  useEffect(() => {
    if (tab === 'trend') fetchTrend();
    else if (tab === 'breakdown') fetchBreakdown();
    else if (tab === 'revenue') fetchRevenue();
  }, [tab, trendMonths, fetchTrend, fetchBreakdown, fetchRevenue]);

  const exportCsv = (rows: string[][], filename: string) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const handleExportTrend = () => {
    if (!trendData.length) return;
    const rows: string[][] = [
      ['Accounting Trend Report', '', '', '', ''],
      ['Company', branding.companyName ?? '', '', '', ''],
      ['Generated', new Date().toLocaleDateString(), '', '', ''],
      [],
      ['Month', 'Year', 'Revenue (₦)', 'Expenses (₦)', 'Commission (₦)', 'Tax (₦)', 'Net Profit (₦)'],
      ...trendData.map((d) => [
        d.month, String(d.year), String(d.revenue), String(d.expenses),
        String(d.commission), String(d.tax), String(d.netProfit),
      ]),
    ];
    exportCsv(rows, 'accounting-trend.csv');
  };

  const handleExportBreakdown = () => {
    if (!breakdown) return;
    const rows: string[][] = [
      ['Expense Breakdown Report'],
      ['Company', branding.companyName ?? ''],
      ['Period', `${customStart} to ${customEnd}`],
      [],
      ['BY CATEGORY'],
      ['Category', 'Type', 'Total (₦)', 'Count'],
      ...(breakdown.byCategory ?? []).map((c: any) => [c.categoryName, c.categoryType, String(c.total), String(c.count)]),
      [],
      ['BY PAYMENT METHOD'],
      ['Method', 'Total (₦)', 'Count'],
      ...(breakdown.byPaymentMethod ?? []).map((p: any) => [p.method, String(p.total), String(p.count)]),
    ];
    exportCsv(rows, 'expense-breakdown.csv');
  };

  const handleExportRevenue = () => {
    if (!revenueData) return;
    const rows: string[][] = [
      ['Revenue Detail Report'],
      ['Company', branding.companyName ?? ''],
      ['Period', `${customStart} to ${customEnd}`],
      ['Total Revenue', String(revenueData.summary?.total ?? 0)],
      [],
      ['Date', 'Property', 'Type', 'Realtor', 'Client', 'Sale Price (₦)', 'Commission (₦)', 'Tax (₦)', 'Payment Plan'],
      ...(revenueData.sales ?? []).map((s: any) => [
        new Date(s.date).toLocaleDateString(), s.property, s.propertyType ?? '', s.realtor, s.client,
        String(s.salePrice), String(s.commission), String(s.tax), s.paymentPlan,
      ]),
    ];
    exportCsv(rows, 'revenue-detail.csv');
  };

  const TABS = [
    { key: 'trend', label: 'Revenue & Expense Trend' },
    { key: 'breakdown', label: 'Expense Breakdown' },
    { key: 'revenue', label: 'Revenue Detail' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Charts, trends, and detailed breakdowns</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={tab === 'trend' ? handleExportTrend : tab === 'breakdown' ? handleExportBreakdown : handleExportRevenue}>
          <FileSpreadsheet className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as ReportTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Trend ─────────────────────────────────────────────────────────── */}
      {tab === 'trend' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show last:</span>
            {([6, 12, 24] as TrendMonths[]).map((m) => (
              <button
                key={m}
                onClick={() => setTrendMonths(m)}
                className={`px-3 py-1 rounded text-sm font-medium ${trendMonths === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {m} months
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Revenue vs Expenses vs Net Profit</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Monthly Revenue Bar Chart</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="commission" name="Commission" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="tax" name="Tax" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Trend Table */}
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Monthly Breakdown Table</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Month</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Revenue</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Commission</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Tax</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Expenses</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Net Profit</th>
                      </tr></thead>
                      <tbody>
                        {trendData.map((d) => (
                          <tr key={`${d.month}-${d.year}`} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{d.month} {d.year}</td>
                            <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(d.revenue)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{formatCurrency(d.commission)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{formatCurrency(d.tax)}</td>
                            <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(d.expenses)}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(d.netProfit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Breakdown ─────────────────────────────────────────────────────── */}
      {tab === 'breakdown' && (
        <div className="space-y-6">
          {/* Date Range */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Date</label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
            </div>
            <Button onClick={fetchBreakdown} variant="outline" className="mt-5 gap-2" disabled={loading}>
              <RefreshCw className="w-4 h-4" /> Apply
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : breakdown ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart by category */}
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Expenses by Category</CardTitle></CardHeader>
                <CardContent>
                  {(breakdown.byCategory ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No approved expenses in this period</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={breakdown.byCategory}
                            dataKey="total"
                            nameKey="categoryName"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ categoryName, percent }) => `${categoryName} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {(breakdown.byCategory ?? []).map((_: any, i: number) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-3 space-y-2">
                        {(breakdown.byCategory ?? []).map((c: any, i: number) => (
                          <div key={c.categoryId} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-gray-700">{c.categoryName}</span>
                              <span className="text-xs text-gray-400">({c.count})</span>
                            </div>
                            <span className="font-medium">{formatCurrency(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Payment Method breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Expenses by Payment Method</CardTitle></CardHeader>
                <CardContent>
                  {(breakdown.byPaymentMethod ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No data</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={breakdown.byPaymentMethod} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="method" tick={{ fontSize: 10 }} tickFormatter={(v) => v.replace('_', ' ')} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="total" name="Amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 space-y-2">
                        {(breakdown.byPaymentMethod ?? []).map((p: any) => (
                          <div key={p.method} className="flex justify-between text-sm">
                            <span className="text-gray-600">{p.method.replace('_', ' ')}</span>
                            <div className="text-right">
                              <span className="font-medium">{formatCurrency(p.total)}</span>
                              <span className="text-gray-400 text-xs ml-2">({p.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tab: Revenue Detail ──────────────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="space-y-6">
          {/* Date Range */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Date</label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
            </div>
            <Button onClick={fetchRevenue} variant="outline" className="mt-5 gap-2" disabled={loading}>
              <RefreshCw className="w-4 h-4" /> Apply
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : revenueData ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Revenue', value: revenueData.summary?.total ?? 0, color: 'text-green-600' },
                  { label: 'Total Commissions', value: revenueData.summary?.totalCommission ?? 0, color: 'text-blue-600' },
                  { label: 'Total Taxes', value: revenueData.summary?.totalTax ?? 0, color: 'text-purple-600' },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className={`text-xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
                      <p className="text-xs text-gray-400">{revenueData.summary?.count ?? 0} sales</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Sales table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Date</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Property</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Realtor</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Client</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Amount Received</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Commission</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Tax</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Plan</th>
                      </tr></thead>
                      <tbody>
                        {(revenueData.sales ?? []).length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-12 text-gray-400">No completed sales in this period</td></tr>
                        ) : (
                          (revenueData.sales ?? []).map((s: any) => (
                            <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(s.date).toLocaleDateString()}</td>
                              <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[160px] truncate">{s.property}</td>
                              <td className="px-4 py-2.5 text-gray-600">{s.realtor}</td>
                              <td className="px-4 py-2.5 text-gray-600">{s.client}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-green-700">{formatCurrency(s.salePrice)}</td>
                              <td className="px-4 py-2.5 text-right text-blue-600">{formatCurrency(s.commission)}</td>
                              <td className="px-4 py-2.5 text-right text-purple-600">{formatCurrency(s.tax)}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-500">{s.paymentPlan}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
