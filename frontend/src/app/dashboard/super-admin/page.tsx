'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Home, DollarSign, Loader2, RefreshCw, Activity, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

function formatNumber(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const overviewRes = await api.get<any>('/companies/overview').catch(() => null);
      const companiesRes = await api.get<any>('/companies?limit=10').catch(() => null);

      if (overviewRes) setStats(overviewRes.data || overviewRes);
      if (companiesRes) {
        const companyData = companiesRes.data || companiesRes;
        setCompanies(Array.isArray(companyData) ? companyData : []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Companies',
      value: stats?.totalCompanies ?? 0,
      display: formatNumber(stats?.totalCompanies ?? 0),
      icon: Building2,
      bg: 'bg-blue-500/10',
      color: 'text-blue-400',
    },
    {
      label: 'Active Companies',
      value: stats?.activeCompanies ?? 0,
      display: formatNumber(stats?.activeCompanies ?? 0),
      icon: Activity,
      bg: 'bg-green-500/10',
      color: 'text-green-400',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      display: formatNumber(stats?.totalUsers ?? 0),
      icon: Users,
      bg: 'bg-purple-500/10',
      color: 'text-purple-400',
    },
    {
      label: 'Total Properties',
      value: stats?.totalProperties ?? 0,
      display: formatNumber(stats?.totalProperties ?? 0),
      icon: Home,
      bg: 'bg-orange-500/10',
      color: 'text-orange-400',
    },
    {
      label: 'Total Sales',
      value: stats?.totalSales ?? 0,
      display: formatNumber(stats?.totalSales ?? 0),
      icon: TrendingUp,
      bg: 'bg-emerald-500/10',
      color: 'text-emerald-400',
    },
    {
      label: 'Total Revenue',
      value: stats?.totalRevenue ?? 0,
      display: '₦' + formatNumber(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      bg: 'bg-amber-500/10',
      color: 'text-amber-400',
    },
  ].filter((s) => s.label !== 'Total Revenue' || (stats?.totalRevenue ?? 0) > 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage all companies from one dashboard</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          className="self-start sm:self-auto border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="bg-slate-800/50 border-slate-700/50 overflow-hidden"
          >
            <CardContent className="p-3 sm:p-4">
              {/* Icon */}
              <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-2.5`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              {/* Value — constrained to box with truncation */}
              <p
                className="text-xl sm:text-2xl font-bold text-white leading-tight truncate"
                title={String(stat.value)}
              >
                {stat.display}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Companies */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-700/50">
          <CardTitle className="text-white text-base sm:text-lg">Recent Companies</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="self-start sm:self-auto border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={() => (window.location.href = '/dashboard/super-admin/companies')}
          >
            View All
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">
              No companies yet. Create your first company to get started.
            </p>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="divide-y divide-slate-700/50 sm:hidden">
                {companies.map((company: any) => (
                  <li key={company.id} className="flex items-start gap-3 p-4">
                    {company.logo ? (
                      <img
                        src={company.logo}
                        alt=""
                        className="w-9 h-9 rounded object-contain shrink-0 bg-slate-700"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-slate-700 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm truncate">
                          {company.name}
                        </span>
                        <Badge
                          variant={company.isActive ? 'default' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {company.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{company.domain}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
                        <span>{company.stats?.users ?? 0} users</span>
                        <span>{company.stats?.properties ?? 0} props</span>
                        <span>{company.stats?.sales ?? 0} sales</span>
                      </div>
                      <code className="mt-1.5 inline-block text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">
                        {company.inviteCode}
                      </code>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Company
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Domain
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Users
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Properties
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Sales
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-400 text-xs uppercase tracking-wide">
                        Invite Code
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company: any) => (
                      <tr
                        key={company.id}
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {company.logo ? (
                              <img
                                src={company.logo}
                                alt=""
                                className="w-8 h-8 rounded object-contain shrink-0 bg-slate-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center shrink-0">
                                <Building2 className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate">{company.name}</p>
                              <p className="text-xs text-slate-500 truncate">{company.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-[160px] truncate">
                          {company.domain}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={company.isActive ? 'default' : 'secondary'}>
                            {company.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {company.stats?.users ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {company.stats?.properties ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {company.stats?.sales ?? 0}
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-xs bg-slate-700/60 text-slate-300 px-2 py-1 rounded">
                            {company.inviteCode}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
