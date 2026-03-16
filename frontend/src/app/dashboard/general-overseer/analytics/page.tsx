'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Home,
  Users,
  Calendar,
  Download,
  RefreshCw,
  Loader2,
  Trophy,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';

type TimePeriod = 'week' | 'month' | 'quarter' | 'year';

interface AnalyticsData {
  stats: {
    totalRevenue: number;
    propertiesSold: number;
    newClients: number;
    avgSalePrice: number;
  };
  chartData: Array<{ label: string; sales: number; revenue: number }>;
  propertyTypes: Array<{ type: string; count: number; percentage: number; revenue: number }>;
  topLocations: Array<{ location: string; sales: number; avgPrice: number }>;
  topPerformers: Array<{
    realtorId: string;
    realtor: { firstName: string; lastName: string; avatar?: string };
    salesCount: number;
    totalRevenue: number;
    totalCommission: number;
  }>;
  topProperties: Array<{
    id: string;
    salePrice: number;
    saleDate: string;
    property: { id: string; title: string; type: string; city: string; images?: string[] };
    realtor: { user: { firstName: string; lastName: string } };
  }>;
  tierDistribution: Record<string, number>;
  period: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export default function GOAnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const fetchAnalytics = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        period: timePeriod,
        year: selectedYear.toString(),
      });
      if (timePeriod === 'month') {
        params.append('month', selectedMonth.toString());
      }
      const raw: any = await api.get(`/admin/analytics?${params.toString()}`);
      // api.get returns the full TransformInterceptor wrapper { success, data, timestamp }
      setData(raw?.data ?? raw);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timePeriod, selectedYear, selectedMonth]);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const maxRevenue = data?.chartData?.length
    ? Math.max(...data.chartData.map(d => d.revenue))
    : 0;
  const totalSales = data?.topLocations?.reduce((sum, loc) => sum + loc.sales, 0) || 1;

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case 'week': return 'This Week';
      case 'month': return `${monthOptions[selectedMonth]} ${selectedYear}`;
      case 'quarter': return `Q${Math.floor(selectedMonth / 3) + 1} ${selectedYear}`;
      case 'year': return `Year ${selectedYear}`;
      default: return 'All Time';
    }
  };

  const handleExportReport = () => {
    if (!data) { toast.error('No data to export'); return; }
    const rows = [
      ['Period', getTimePeriodLabel()],
      ['Total Revenue', formatCurrency(data.stats.totalRevenue)],
      ['Properties Sold', data.stats.propertiesSold.toString()],
      ['New Clients', data.stats.newClients.toString()],
      ['Avg. Sale Price', formatCurrency(data.stats.avgSalePrice)],
      [''],
      ['Property Type', 'Count', 'Revenue'],
      ...(data.propertyTypes?.map(pt => [pt.type, pt.count.toString(), formatCurrency(pt.revenue)]) || []),
      [''],
      ['Location', 'Sales', 'Avg. Price'],
      ...(data.topLocations?.map(loc => [loc.location || 'Unknown', loc.sales.toString(), formatCurrency(loc.avgPrice)]) || []),
    ];
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timePeriod}-${selectedYear}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statsDisplay = [
    { title: 'Total Revenue', value: data?.stats?.totalRevenue || 0, icon: NairaSign, color: 'text-primary', bgColor: 'bg-primary/10', isCurrency: true },
    { title: 'Properties Sold', value: data?.stats?.propertiesSold || 0, icon: Home, color: 'text-green-600', bgColor: 'bg-green-100', isCurrency: false },
    { title: 'New Clients', value: data?.stats?.newClients || 0, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100', isCurrency: false },
    { title: 'Avg. Sale Price', value: data?.stats?.avgSalePrice || 0, icon: TrendingUp, color: 'text-purple-600', bgColor: 'bg-purple-100', isCurrency: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide business performance overview</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant={timePeriod === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setTimePeriod('week')}>
            <Calendar className="w-4 h-4 mr-2" />Week
          </Button>
          <Button variant={timePeriod === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setTimePeriod('month')}>Month</Button>
          <Button variant={timePeriod === 'quarter' ? 'default' : 'outline'} size="sm" onClick={() => setTimePeriod('quarter')}>Quarter</Button>
          <Button variant={timePeriod === 'year' ? 'default' : 'outline'} size="sm" onClick={() => setTimePeriod('year')}>Year</Button>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-9 px-3 py-1 border rounded-md text-sm bg-background"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {timePeriod === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="h-9 px-3 py-1 border rounded-md text-sm bg-background"
            >
              {monthOptions.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </select>
          )}

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsDisplay.map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold">
                  {stat.isCurrency ? formatCurrency(stat.value) : stat.value}
                </h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />Revenue Overview
              </CardTitle>
              <Badge variant="outline">{getTimePeriodLabel()}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.chartData && data.chartData.length > 0 ? (
                  data.chartData.map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-muted-foreground">{formatCurrency(item.revenue)} ({item.sales} sales)</span>
                      </div>
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: maxRevenue > 0 ? `${(item.revenue / maxRevenue) * 100}%` : '0%' }}
                          transition={{ delay: 0.5, duration: 0.5 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available for this period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Property Types */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />Sales by Property Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.propertyTypes && data.propertyTypes.length > 0 ? (
                  data.propertyTypes.map((type) => (
                    <div key={type.type} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{type.type}</span>
                          <Badge variant="secondary">{type.count} sales</Badge>
                        </div>
                        <span className="text-muted-foreground">{formatCurrency(type.revenue)}</span>
                      </div>
                      <Progress value={type.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">{type.percentage}% of total</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available for this period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Locations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />Top Performing Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.topLocations && data.topLocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b">
                      <th className="pb-4 font-medium min-w-[180px]">Location</th>
                      <th className="pb-4 font-medium min-w-[120px]">Total Sales</th>
                      <th className="pb-4 font-medium min-w-[150px]">Avg. Sale Price</th>
                      <th className="pb-4 font-medium min-w-[150px]">Market Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topLocations.map((location, index) => (
                      <tr key={location.location || index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            <span className="font-medium">{location.location || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-4">{location.sales} properties</td>
                        <td className="py-4 font-semibold text-primary">{formatCurrency(location.avgPrice)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Progress value={(location.sales / totalSales) * 100} className="h-2 w-24" />
                            <span className="text-sm text-muted-foreground">
                              {((location.sales / totalSales) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No location data available for this period</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Performers */}
      {data?.topPerformers && data.topPerformers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />Top Performing Realtors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b">
                      <th className="pb-4 font-medium min-w-[180px]">Realtor</th>
                      <th className="pb-4 font-medium min-w-[100px]">Sales</th>
                      <th className="pb-4 font-medium min-w-[150px]">Total Revenue</th>
                      <th className="pb-4 font-medium min-w-[150px]">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topPerformers.map((performer, index) => (
                      <tr key={performer.realtorId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            <span className="font-medium">
                              {performer.realtor?.firstName} {performer.realtor?.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4">{performer.salesCount}</td>
                        <td className="py-4 font-semibold text-primary">{formatCurrency(Number(performer.totalRevenue || 0))}</td>
                        <td className="py-4 text-muted-foreground">{formatCurrency(Number(performer.totalCommission || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tier Distribution — GO exclusive */}
      {data?.tierDistribution && Object.keys(data.tierDistribution).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />Realtor Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as const).map((tier) => {
                  const count = data.tierDistribution[tier] ?? 0;
                  const tierStyles: Record<string, { bg: string; text: string; border: string }> = {
                    PLATINUM: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
                    GOLD: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-700' },
                    SILVER: { bg: 'bg-gray-50 dark:bg-gray-800/50', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-600' },
                    BRONZE: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700' },
                  };
                  const style = tierStyles[tier];
                  return (
                    <div key={tier} className={`rounded-xl border p-4 text-center ${style.bg} ${style.border}`}>
                      <p className={`text-3xl font-bold ${style.text}`}>{count}</p>
                      <p className={`text-sm font-semibold mt-1 ${style.text}`}>{tier}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">realtors</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Top Properties by Sale Price — GO exclusive */}
      {data?.topProperties && data.topProperties.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />Top Properties by Sale Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="pb-3 font-medium">#</th>
                      <th className="pb-3 font-medium">Property</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Location</th>
                      <th className="pb-3 font-medium">Sold By</th>
                      <th className="pb-3 font-medium">Sale Price</th>
                      <th className="pb-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topProperties.map((sale, index) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3">
                          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 font-medium max-w-[180px] truncate" title={sale.property?.title}>
                          {sale.property?.title ?? '—'}
                        </td>
                        <td className="py-3">
                          <Badge variant="secondary" className="text-xs">{sale.property?.type ?? '—'}</Badge>
                        </td>
                        <td className="py-3 text-muted-foreground">{sale.property?.city ?? '—'}</td>
                        <td className="py-3 text-muted-foreground">
                          {sale.realtor?.user ? `${sale.realtor.user.firstName} ${sale.realtor.user.lastName}` : '—'}
                        </td>
                        <td className="py-3 font-semibold text-primary">{formatCurrency(Number(sale.salePrice || 0))}</td>
                        <td className="py-3 text-muted-foreground whitespace-nowrap">
                          {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
