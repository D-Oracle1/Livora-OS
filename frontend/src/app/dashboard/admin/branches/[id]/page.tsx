'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import {
  Building2, ArrowLeft, Users, Home, TrendingUp, DollarSign,
  Loader2, RefreshCw, BarChart3, UserCheck, MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import Link from 'next/link';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [branch, setBranch]   = useState<any>(null);
  const [stats, setStats]     = useState<any>(null);
  const [agents, setAgents]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try {
      const [branchData, statsData, agentsData] = await Promise.all([
        api.get(`/branches/${id}`),
        api.get(`/branches/${id}/stats?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/branches/${id}/agents?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setBranch(branchData);
      setStats(statsData);
      setAgents(agentsData ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const agentChartData = agents.map(a => ({
    name:      a.name.split(' ')[0],
    Revenue:   a.totalRevenue,
    Sales:     a.totalSales,
  }));

  const kpis = stats ? [
    { label: 'Revenue',        value: fmt(stats.sales?.revenue ?? 0),    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950',  icon: DollarSign },
    { label: 'Net Profit',     value: fmt(stats.netProfit ?? 0),          color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950', icon: TrendingUp },
    { label: 'Sales Closed',   value: String(stats.sales?.count ?? 0),   color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950',    icon: BarChart3 },
    { label: 'Expenses',       value: fmt(stats.expenses?.amount ?? 0),  color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950',      icon: DollarSign },
    { label: 'Total Staff',    value: String(Object.values(stats.staff ?? {}).reduce((a: any, b: any) => a + b, 0)), color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', icon: Users },
    { label: 'New Leads',      value: String(stats.leads?.find((l: any) => l.status === 'NEW')?.count ?? 0), color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950', icon: UserCheck },
  ] : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/branches">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
            <ArrowLeft className="w-4 h-4" />Back
          </Button>
        </Link>
        {branch && (
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{branch.name}</h1>
              <Badge variant="outline" className="font-mono text-xs">{branch.code}</Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPin className="w-3 h-3" />{branch.city}, {branch.state}
            </div>
          </div>
        )}
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Start Date</Label>
          <Input type="date" value={startDate} onChange={e => setStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">End Date</Label>
          <Input type="date" value={endDate} onChange={e => setEnd(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Apply
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map(({ label, value, color, bg, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="p-3 flex items-start gap-2">
                  <div className={`p-1.5 rounded-md ${bg}`}><Icon className={`w-3.5 h-3.5 ${color}`} /></div>
                  <div>
                    <p className="text-xs text-gray-500 leading-none">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${color}`}>{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="agents">
            <TabsList>
              <TabsTrigger value="agents">Agent Performance</TabsTrigger>
              <TabsTrigger value="leads">Lead Pipeline</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>

            <TabsContent value="agents" className="mt-4 space-y-4">
              {agents.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-gray-500 text-sm">No agents in this branch.</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Agent Revenue</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={agentChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="overflow-x-auto p-4">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-xs text-gray-500">
                          <th className="text-left py-2 pr-4 font-medium">Agent</th>
                          <th className="text-right py-2 px-3 font-medium">Sales</th>
                          <th className="text-right py-2 px-3 font-medium">Revenue</th>
                          <th className="text-right py-2 pl-3 font-medium">Commission</th>
                        </tr></thead>
                        <tbody>
                          {agents.sort((a, b) => b.totalRevenue - a.totalRevenue).map((a) => (
                            <tr key={a.agentId} className="border-b last:border-0">
                              <td className="py-2.5 pr-4">
                                <div className="font-medium text-gray-900 dark:text-white">{a.name}</div>
                                <div className="text-xs text-gray-400">{a.email}</div>
                              </td>
                              <td className="text-right px-3"><Badge variant="secondary">{a.totalSales}</Badge></td>
                              <td className="text-right px-3 font-medium text-green-600">{fmt(a.totalRevenue)}</td>
                              <td className="text-right pl-3 text-amber-600">{fmt(a.totalCommission)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="leads" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Lead Pipeline</CardTitle></CardHeader>
                <CardContent>
                  {(!stats?.leads || stats.leads.length === 0) ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No leads this period.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {stats.leads.map(({ status, count }: any) => (
                        <div key={status} className="flex flex-col items-center px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 min-w-[90px]">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
                          <span className="text-xs text-gray-500 mt-0.5 text-center">{status.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="properties" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Property Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(stats?.properties ?? {}).map(([status, count]: any) => (
                      <div key={status} className="flex flex-col items-center px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 min-w-[100px]">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
                        <span className="text-xs text-gray-500 mt-0.5 text-center">{status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
