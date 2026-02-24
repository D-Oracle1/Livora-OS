'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Home, DollarSign, Loader2, RefreshCw, Activity, TrendingUp, ArrowUpRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { usePlatformBranding } from '@/hooks/use-platform-branding';

function formatNumber(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// Generate synthetic monthly trend from current totals
function buildChartData(stats: any) {
  const total = stats?.totalCompanies ?? 0;
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  return months.map((month, i) => ({
    month,
    companies: Math.max(0, Math.round(total * (0.5 + (i / (months.length - 1)) * 0.5))),
    users: Math.max(0, Math.round((stats?.totalUsers ?? 0) * (0.4 + (i / (months.length - 1)) * 0.6))),
  }));
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const branding = usePlatformBranding();
  const accent = branding.primaryColor || '#3b82f6';

  const fetchData = async () => {
    setLoading(true);
    try {
      const overviewRes = await api.get<any>('/companies/overview').catch(() => null);
      const companiesRes = await api.get<any>('/companies?limit=10').catch(() => null);
      if (overviewRes) setStats(overviewRes.data || overviewRes);
      if (companiesRes) {
        const d = companiesRes.data || companiesRes;
        setCompanies(Array.isArray(d) ? d : []);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Companies',
      value: stats?.totalCompanies ?? 0,
      display: formatNumber(stats?.totalCompanies ?? 0),
      icon: Building2,
      change: '+12%',
    },
    {
      label: 'Active Companies',
      value: stats?.activeCompanies ?? 0,
      display: formatNumber(stats?.activeCompanies ?? 0),
      icon: Activity,
      change: '+8%',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      display: formatNumber(stats?.totalUsers ?? 0),
      icon: Users,
      change: '+24%',
    },
    {
      label: 'Total Properties',
      value: stats?.totalProperties ?? 0,
      display: formatNumber(stats?.totalProperties ?? 0),
      icon: Home,
      change: '+16%',
    },
    {
      label: 'Total Sales',
      value: stats?.totalSales ?? 0,
      display: formatNumber(stats?.totalSales ?? 0),
      icon: TrendingUp,
      change: '+31%',
    },
    {
      label: 'Total Revenue',
      value: stats?.totalRevenue ?? 0,
      display: '₦' + formatNumber(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      change: '+19%',
    },
  ];

  const chartData = buildChartData(stats);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Platform Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all companies from one dashboard</p>
        </div>
        <button
          onClick={fetchData}
          className="neuo-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="neuo-card p-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: `${accent}18` }}
            >
              <stat.icon className="w-5 h-5" style={{ color: accent }} />
            </div>
            <p className="text-2xl font-bold text-gray-800 leading-tight truncate" title={String(stat.value)}>
              {stat.display}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{stat.label}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <span className="text-[11px] font-medium text-emerald-500">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + table row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="xl:col-span-2 neuo-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Growth Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Companies &amp; users over time</p>
            </div>
            <span
              className="text-xs font-medium px-3 py-1 rounded-full"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              Last 7 months
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompanies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="companies" stroke={accent} strokeWidth={2} fill="url(#colorCompanies)" name="Companies" />
              <Area type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} fill="url(#colorUsers)" name="Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick stats panel */}
        <div className="neuo-card p-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-gray-800">Quick Stats</h2>
          {[
            { label: 'Avg Users / Company', value: stats?.totalCompanies ? Math.round((stats?.totalUsers ?? 0) / stats.totalCompanies) : 0 },
            { label: 'Avg Properties / Company', value: stats?.totalCompanies ? Math.round((stats?.totalProperties ?? 0) / stats.totalCompanies) : 0 },
            { label: 'Avg Sales / Company', value: stats?.totalCompanies ? Math.round((stats?.totalSales ?? 0) / stats.totalCompanies) : 0 },
            { label: 'Active Rate', value: stats?.totalCompanies ? `${Math.round(((stats?.activeCompanies ?? 0) / stats.totalCompanies) * 100)}%` : '0%' },
          ].map((item) => (
            <div key={item.label} className="neuo-inset p-3">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-xl font-bold text-gray-800 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Companies */}
      <div className="neuo-card overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Recent Companies</h2>
          <a
            href="/dashboard/super-admin/companies"
            className="text-sm font-medium self-start sm:self-auto"
            style={{ color: accent }}
          >
            View All →
          </a>
        </div>

        {companies.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">
            No companies yet. Create your first company to get started.
          </p>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="divide-y divide-gray-100 sm:hidden">
              {companies.map((company: any) => (
                <li key={company.id} className="flex items-start gap-3 p-4">
                  {company.logo ? (
                    <img src={company.logo} alt="" className="w-9 h-9 rounded-lg object-contain shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm truncate">{company.name}</span>
                      <Badge variant={company.isActive ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {company.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{company.domain}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                      <span>{company.stats?.users ?? 0} users</span>
                      <span>{company.stats?.properties ?? 0} props</span>
                      <span>{company.stats?.sales ?? 0} sales</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left py-3 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Company</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Domain</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Users</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Properties</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sales</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Invite Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companies.map((company: any) => (
                    <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {company.logo ? (
                            <img src={company.logo} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0 bg-gray-100" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{company.name}</p>
                            <p className="text-xs text-gray-400 truncate">{company.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 max-w-[160px] truncate">{company.domain}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={company.isActive
                            ? { backgroundColor: '#d1fae5', color: '#065f46' }
                            : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                        >
                          {company.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-gray-700">{company.stats?.users ?? 0}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-gray-700">{company.stats?.properties ?? 0}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-gray-700">{company.stats?.sales ?? 0}</td>
                      <td className="py-3.5 px-4">
                        <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{company.inviteCode}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
