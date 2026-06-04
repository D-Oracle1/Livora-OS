'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Award,
  Users,
  Home,
  ArrowUpRight,
  Target,
  Zap,
  Star,
  Clock,
  Loader2,
  Trophy,
  Crown,
  Copy,
  Check,
  Users2,
  Link,
} from 'lucide-react';
import { AwardBanner } from '@/components/award-banner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, getTierBgClass } from '@/lib/utils';
import { NairaSign } from '@/components/icons/naira-sign';
import { api, getImageUrl } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

type Period = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const tierProgress: Record<string, { min: number; max: number; next: string | null }> = {
  BRONZE: { min: 0, max: 5000, next: 'SILVER' },
  SILVER: { min: 5000, max: 15000, next: 'GOLD' },
  GOLD: { min: 15000, max: 50000, next: 'PLATINUM' },
  PLATINUM: { min: 50000, max: 100000, next: null },
};

function getLast12Months() {
  const months: { label: string; month: number; year: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return months;
}

export default function RealtorDashboard() {
  const [period, setPeriod] = useState<Period>('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Realtor');
  const [realtorOfMonth, setRealtorOfMonth] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserName(`${user.firstName} ${user.lastName}`);
      if (user.referralCode) setReferralCode(user.referralCode);
    }
  }, []);

  const handleCopyReferral = () => {
    const link = `${window.location.origin}/auth/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const fetchRealtorOfMonth = async () => {
      try {
        // Fetch from awards system to stay in sync with the celebration modal
        const res: any = await api.get('/awards/realtor-of-month');
        const award = res?.data !== undefined ? res.data : res;
        setRealtorOfMonth(award && award.user ? award : null);
      } catch {
        setRealtorOfMonth(null);
      }
    };
    fetchRealtorOfMonth();
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        let url = `/realtors/dashboard?period=${period.toLowerCase()}`;
        if (period === 'MONTHLY') {
          url += `&month=${selectedMonth}&year=${selectedYear}`;
        } else if (period === 'YEARLY') {
          url += `&year=${selectedYear}`;
        }
        const res: any = await api.get(url);
        setDashboardData(res.data || res);
      } catch {
        setDashboardData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [period, selectedMonth, selectedYear]);

  const periodLabel = useMemo(() => {
    if (period === 'MONTHLY') {
      const d = new Date(selectedYear, selectedMonth, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (period === 'YEARLY') return String(selectedYear);
    if (period === 'WEEKLY') return 'This Week';
    return 'Today';
  }, [period, selectedMonth, selectedYear]);

  const stats = dashboardData?.stats;
  const loyalty = dashboardData?.loyalty;
  const chartData = dashboardData?.chartData || [];
  const recentSales = dashboardData?.recentSales || [];

  const filteredSales = stats?.filteredSales || 0;
  const filteredRevenue = stats?.filteredRevenue || 0;
  const filteredCommission = stats?.filteredCommission || 0;
  const filteredNetEarnings = stats?.filteredNetEarnings || 0;
  const filteredTax = stats?.filteredTax || 0;
  const totalSales = stats?.totalSales || 0;
  const totalCommission = stats?.totalCommission || 0;
  const clients = stats?.clients || 0;
  const properties = stats?.properties || 0;

  const tier = loyalty?.tier || 'BRONZE';
  const points = loyalty?.points || 0;
  const currentTierInfo = tierProgress[tier] || tierProgress.BRONZE;
  const progressToNext = ((points - currentTierInfo.min) / (currentTierInfo.max - currentTierInfo.min)) * 100;

  const earningsBreakdown = useMemo(() => [
    { name: 'Net Earnings', value: Number(filteredNetEarnings), color: '#2b1464' },
    { name: 'Tax Deducted', value: Number(filteredTax), color: '#fca639' },
  ].filter((e) => e.value > 0), [filteredNetEarnings, filteredTax]);

  const bottomStats = [
    { label: 'Active Listings', value: String(properties), icon: Home, color: '#2b1464' },
    { label: 'Total Clients', value: String(clients), icon: Users, color: '#fca639' },
    { label: 'Loyalty Points', value: points.toLocaleString(), icon: Award, color: '#2b1464' },
  ];

  const gradientCards = [
    { title: 'Total Sales', value: String(totalSales), subtitle: `${formatCurrency(stats?.totalSalesValue || 0)} value`, gradient: 'from-[#2b1464] to-[#3b2190]', icon: Target },
    { title: `${periodLabel} Sales`, value: String(filteredSales), subtitle: periodLabel, gradient: 'from-[#fca639] to-[#fdb95c]', icon: TrendingUp },
    { title: 'Commission', value: formatCurrency(filteredCommission), subtitle: periodLabel, gradient: 'from-[#2b1464] to-[#14956e]', icon: NairaSign },
    { title: 'Net Earnings', value: formatCurrency(filteredNetEarnings), subtitle: `After tax`, gradient: 'from-[#fca639] to-[#e8953a]', icon: Zap },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <Badge className="bg-[#2b1464]/10 text-[#2b1464] hover:bg-[#2b1464]/20">Completed</Badge>;
      case 'IN_PROGRESS': return <Badge className="bg-blue-100 text-blue-600 hover:bg-blue-200">In Progress</Badge>;
      case 'PENDING': return <Badge className="bg-[#fca639]/10 text-[#fca639] hover:bg-[#fca639]/20">Pending</Badge>;
      case 'CANCELLED': return <Badge className="bg-red-100 text-red-600 hover:bg-red-200">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <AwardBanner />

      {/* Realtor of the Month Spotlight Card */}
      {realtorOfMonth && realtorOfMonth.user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/50 dark:via-yellow-950/50 dark:to-orange-950/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                {/* Trophy Icon */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Star className="w-4 h-4 text-yellow-800 fill-yellow-800" />
                  </div>
                </div>

                {/* Winner Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Realtor of the Month
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 border-3 border-amber-400 shadow-md">
                      <AvatarImage
                        src={realtorOfMonth.user?.avatar ? getImageUrl(realtorOfMonth.user.avatar) : undefined}
                        alt={`${realtorOfMonth.user?.firstName} ${realtorOfMonth.user?.lastName}`}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-lg font-bold">
                        {realtorOfMonth.user?.firstName?.[0]}{realtorOfMonth.user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {realtorOfMonth.user?.firstName} {realtorOfMonth.user?.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {realtorOfMonth.month && realtorOfMonth.year
                          ? new Date(realtorOfMonth.year, realtorOfMonth.month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                          : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        } Winner
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason Badge */}
                {realtorOfMonth.reason && (
                  <div className="hidden md:flex flex-col items-center gap-1 px-6 py-3 bg-white/50 dark:bg-black/20 rounded-xl max-w-[200px]">
                    <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-muted-foreground font-medium text-center line-clamp-2">
                      {realtorOfMonth.reason}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Row 1: Main Chart + Earnings Donut */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Welcome back, {userName}!</CardTitle>
                  <p className="text-sm text-muted-foreground">Performance overview - {periodLabel}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as Period[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          period === p
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {period === 'MONTHLY' && (
                    <Select
                      value={`${selectedYear}-${selectedMonth}`}
                      onValueChange={(val) => {
                        const [y, m] = val.split('-').map(Number);
                        setSelectedYear(y);
                        setSelectedMonth(m);
                      }}
                    >
                      <SelectTrigger className="w-[170px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getLast12Months().map(({ label, month, year }) => (
                          <SelectItem key={`${year}-${month}`} value={`${year}-${month}`}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[280px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid md:grid-cols-[200px_1fr] gap-6">
                  <div className="space-y-6">
                    <div>
                      <p className="text-3xl font-bold">{formatCurrency(filteredCommission)}</p>
                      <p className="text-sm text-muted-foreground">{periodLabel} Commission</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{filteredSales}</p>
                      <p className="text-sm text-muted-foreground">{periodLabel} Sales</p>
                    </div>
                    <Button className="bg-[#2b1464] hover:bg-[#1e0e47] text-white rounded-full px-6" asChild>
                      <a href="/dashboard/realtor/sales">View All Sales</a>
                    </Button>
                  </div>
                  <div className="h-[220px]">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2b1464" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#2b1464" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fca639" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#fca639" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: number, name: string) => [
                              name === 'revenue' ? formatCurrency(value) : value,
                              name === 'revenue' ? 'Revenue' : 'Sales',
                            ]}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#2b1464" strokeWidth={2.5} fill="url(#colorComm)" name="Revenue" dot={{ r: 4, fill: '#2b1464', stroke: '#fff', strokeWidth: 2 }} />
                          <Area type="monotone" dataKey="sales" stroke="#fca639" strokeWidth={2.5} fill="url(#colorSales)" name="Sales" dot={{ r: 4, fill: '#fca639', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No sales data for this period
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                {bottomStats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                      <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="font-semibold">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Earnings Donut + Loyalty */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-lg">Earnings Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={earningsBreakdown.length > 0 ? earningsBreakdown : [{ name: 'No Data', value: 1, color: '#e5e7eb' }]}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}
                    >
                      {(earningsBreakdown.length > 0 ? earningsBreakdown : [{ color: '#e5e7eb' }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value: number) => [formatCurrency(value), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2 w-full">
                {earningsBreakdown.map((item) => {
                  const total = earningsBreakdown.reduce((s, i) => s + i.value, 0);
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <span className="font-bold">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Loyalty Progress */}
              <div className="w-full mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getTierBgClass(tier)}>{tier}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {currentTierInfo.next ? `Next: ${currentTierInfo.next}` : 'Max Tier'}
                  </span>
                </div>
                <Progress value={Math.min(progressToNext, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {points.toLocaleString()} / {currentTierInfo.max.toLocaleString()} points
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Row 2: Gradient Mini Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {gradientCards.map((card, index) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.05 }}>
            <Card className={`bg-gradient-to-br ${card.gradient} text-white overflow-hidden shadow-sm border-0`}>
              <CardContent className="p-5 relative">
                <div className="absolute top-3 right-3 opacity-20">
                  <card.icon className="w-12 h-12" />
                </div>
                <p className="text-sm font-medium opacity-90">{card.title}</p>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs opacity-75 mt-1">{card.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Referral Link Card */}
      {referralCode && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2b1464]/10 flex items-center justify-center">
                    <Link className="w-5 h-5 text-[#2b1464]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Your Referral Link</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/auth/register?ref=${referralCode}` : referralCode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyReferral} className="gap-1.5">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" className="bg-[#2b1464] hover:bg-[#1e0e47] text-white gap-1.5" asChild>
                    <a href="/dashboard/realtor/referrals">
                      <Users2 className="w-4 h-4" />
                      View Leads
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Row 3: Recent Sales Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">My Recent Sales</CardTitle>
                <p className="text-sm text-muted-foreground">{periodLabel}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/realtor/sales">View All Sales</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recentSales.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#2b1464] hover:bg-[#2b1464]">
                      <TableHead className="text-white font-semibold text-xs">PROPERTY</TableHead>
                      <TableHead className="text-white font-semibold text-xs">CLIENT</TableHead>
                      <TableHead className="text-white font-semibold text-xs">AMOUNT</TableHead>
                      <TableHead className="text-white font-semibold text-xs">STATUS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-sm">
                          <p className="font-medium truncate max-w-[200px]">{sale.property?.title || 'Unknown'}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.client?.user ? `${sale.client.user.firstName} ${sale.client.user.lastName}` : 'Unknown'}
                        </TableCell>
                        <TableCell className="font-semibold text-[#2b1464] text-sm">{formatCurrency(Number(sale.salePrice || sale.commissionAmount || 0))}</TableCell>
                        <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sales found for this period
              </div>
            )}
            <div className="p-3 border-t">
              <Button variant="outline" className="w-full" size="sm" asChild>
                <a href="/dashboard/realtor/sales">View All Sales</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
