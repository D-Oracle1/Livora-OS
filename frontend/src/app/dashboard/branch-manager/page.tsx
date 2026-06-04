'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, Home, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, BarChart3, Target,
  UserCheck, Loader2, RefreshCw, MapPin, ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import Link from 'next/link';

interface BranchStats {
  period: { startDate: string; endDate: string };
  staff: Record<string, number>;
  properties: Record<string, number>;
  sales: { count: number; revenue: number; commission: number; netProfit: number };
  expenses: { count: number; amount: number };
  netProfit: number;
  leads: { status: string; count: number }[];
}

interface AgentRow {
  agentId: string;
  name: string;
  email: string;
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function BranchManagerDashboard() {
  const [stats, setStats]     = useState<BranchStats | null>(null);
  const [agents, setAgents]   = useState<AgentRow[]>([]);
  const [branch, setBranch]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const user = getUser();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const branchId = user?.branchId;
      if (!branchId) { setError('No branch assigned to your account. Contact an admin.'); return; }

      const [branchData, statsData, agentsData] = await Promise.all([
        api.get(`/branches/${branchId}`),
        api.get(`/branches/${branchId}/stats`),
        api.get(`/branches/${branchId}/agents`),
      ]);
      setBranch(branchData);
      setStats(statsData);
      setAgents(agentsData ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-red-600 font-medium">{error}</p>
          <Button onClick={load} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
        </div>
      </div>
    );
  }

  const totalStaff     = Object.values(stats?.staff ?? {}).reduce((a, b) => a + b, 0);
  const availableProps = stats?.properties?.AVAILABLE ?? 0;
  const soldProps      = stats?.properties?.SOLD ?? 0;
  const newLeads       = stats?.leads?.find(l => l.status === 'NEW')?.count ?? 0;
  const wonLeads       = stats?.leads?.find(l => l.status === 'WON')?.count ?? 0;

  const summaryCards = [
    { label: 'Total Revenue',   value: formatCurrency(stats?.sales.revenue ?? 0),   icon: DollarSign,   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Net Profit',      value: formatCurrency(stats?.netProfit ?? 0),         icon: TrendingUp,   color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
    { label: 'Sales Closed',    value: String(stats?.sales.count ?? 0),               icon: Target,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Total Staff',     value: String(totalStaff),                             icon: Users,        color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Properties',      value: `${availableProps} avail / ${soldProps} sold`,  icon: Home,         color: 'text-cyan-600',   bg: 'bg-cyan-50 dark:bg-cyan-950' },
    { label: 'New Leads',       value: String(newLeads),                               icon: UserCheck,    color: 'text-rose-600',   bg: 'bg-rose-50 dark:bg-rose-950' },
    { label: 'Leads Won',       value: String(wonLeads),                               icon: BarChart3,    color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
    { label: 'Total Expenses',  value: formatCurrency(stats?.expenses.amount ?? 0),   icon: ArrowDownRight, color: 'text-red-600',  bg: 'bg-red-50 dark:bg-red-950' },
  ];

  const quickLinks = [
    { href: '/dashboard/branch-manager/properties', icon: Home,             label: 'Properties' },
    { href: '/dashboard/branch-manager/leads',      icon: UserCheck,        label: 'Leads' },
    { href: '/dashboard/branch-manager/staff',      icon: Users,            label: 'Staff' },
    { href: '/dashboard/branch-manager/reports',    icon: BarChart3,        label: 'Reports' },
    { href: '/dashboard/branch-manager/transfers',  icon: ArrowRightLeft,   label: 'Transfers' },
  ];

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {branch?.name ?? 'Branch Dashboard'}
            </h1>
            <Badge variant="outline" className="text-xs">{branch?.code}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>{branch?.city}, {branch?.state}</span>
          </div>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {quickLinks.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                <Icon className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 leading-none mb-1">{label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Agent Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Agent Performance (This Month)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {agents.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No agents assigned to this branch yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 pr-4 font-medium">Agent</th>
                  <th className="text-right py-2 px-3 font-medium">Sales</th>
                  <th className="text-right py-2 px-3 font-medium">Revenue</th>
                  <th className="text-right py-2 pl-3 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {agents
                  .sort((a, b) => b.totalRevenue - a.totalRevenue)
                  .map((agent) => (
                    <tr key={agent.agentId} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-gray-900 dark:text-white">{agent.name}</div>
                        <div className="text-xs text-gray-400">{agent.email}</div>
                      </td>
                      <td className="text-right px-3">
                        <Badge variant="secondary">{agent.totalSales}</Badge>
                      </td>
                      <td className="text-right px-3 font-medium text-green-600">
                        {formatCurrency(agent.totalRevenue)}
                      </td>
                      <td className="text-right pl-3 text-amber-600">
                        {formatCurrency(agent.totalCommission)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Lead Pipeline Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Lead Pipeline (This Month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!stats?.leads || stats.leads.length === 0) ? (
            <p className="text-sm text-gray-500 py-2 text-center">No leads recorded this period.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {stats.leads.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{status.replace('_', ' ')}</span>
                  <Badge>{count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
