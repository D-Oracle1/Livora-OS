'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Home, DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { usePlatformBranding } from '@/hooks/use-platform-branding';

export default function SuperAdminAnalytics() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const branding = usePlatformBranding();
  const accent = branding.primaryColor || '#3b82f6';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/companies?limit=100');
      const result = res.data?.data || res.data || res;
      setCompanies(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
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

  const byUsers = [...companies].sort((a, b) => (b.stats?.users || 0) - (a.stats?.users || 0));
  const byProperties = [...companies].sort((a, b) => (b.stats?.properties || 0) - (a.stats?.properties || 0));
  const bySales = [...companies].sort((a, b) => (b.stats?.sales || 0) - (a.stats?.sales || 0));

  const rankingColumns = [
    { title: 'Top by Users', icon: Users, data: byUsers, key: 'users' },
    { title: 'Top by Properties', icon: Home, data: byProperties, key: 'properties' },
    { title: 'Top by Sales', icon: DollarSign, data: bySales, key: 'sales' },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Platform Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cross-company performance breakdown</p>
        </div>
        <button onClick={fetchData} className="neuo-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Rankings */}
      <div className="grid md:grid-cols-3 gap-5">
        {rankingColumns.map(({ title, icon: Icon, data, key }) => (
          <div key={title} className="neuo-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}18` }}>
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            </div>
            <div className="space-y-2.5">
              {data.slice(0, 10).map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                    <span className="text-sm text-gray-700 truncate">{c.name}</span>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ml-2"
                    style={{ backgroundColor: `${accent}15`, color: accent }}
                  >
                    {c.stats?.[key] || 0}
                  </span>
                </div>
              ))}
              {companies.length === 0 && <p className="text-sm text-gray-400">No data</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="neuo-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">All Companies Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left py-3 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Company</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Users</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Properties</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sales</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Plan</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-gray-800">{c.name}</td>
                  <td className="py-3.5 px-4 text-right text-gray-600">{c.stats?.users || 0}</td>
                  <td className="py-3.5 px-4 text-right text-gray-600">{c.stats?.properties || 0}</td>
                  <td className="py-3.5 px-4 text-right text-gray-600">{c.stats?.sales || 0}</td>
                  <td className="py-3.5 px-4 text-gray-600 capitalize">{c.plan || 'standard'}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={c.isActive
                        ? { backgroundColor: '#d1fae5', color: '#065f46' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
