'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Target, DollarSign, Users,
  RefreshCw, Facebook, Instagram, Globe, MessageCircle,
  BarChart3, Award, Clock, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const SOURCE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  FACEBOOK:  { icon: Facebook,      color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900' },
  INSTAGRAM: { icon: Instagram,     color: 'text-pink-600',   bg: 'bg-pink-100 dark:bg-pink-900' },
  GOOGLE:    { icon: Globe,         color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900' },
  WEBSITE:   { icon: Globe,         color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900' },
  WHATSAPP:  { icon: MessageCircle, color: 'text-emerald-600',bg: 'bg-emerald-100 dark:bg-emerald-900' },
  MESSENGER: { icon: MessageCircle, color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-900' },
  MANUAL:    { icon: Users,         color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-800' },
  REFERRAL:  { icon: Users,         color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900' },
};

function StatCard({ title, value, sub, icon: Icon, color, trend }: any) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl', color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}% vs last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CampaignsPage() {
  const [data, setData] = useState<any>(null);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rep, staff] = await Promise.all([
        api.get(`/leads/reports${dateFrom && dateTo ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ''}`),
        api.get('/leads/staff-performance'),
      ]);
      setData(rep);
      setStaffData(Array.isArray(staff) ? staff : []);
    } catch { /**/ } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals ?? {};
  const convRate = totals.totalLeads > 0
    ? ((totals.converted / totals.totalLeads) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Campaign ROI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead source analytics &amp; staff performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date" className="h-9 w-[150px]" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date" className="h-9 w-[150px]" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />Apply
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Leads" value={totals.totalLeads?.toLocaleString() ?? 0}
              icon={Users} color="bg-blue-100 text-blue-600 dark:bg-blue-950"
            />
            <StatCard
              title="Converted (Won)" value={totals.converted?.toLocaleString() ?? 0}
              sub={`${convRate}% conversion rate`}
              icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-950"
            />
            <StatCard
              title="Hot Leads 🔥" value={totals.hot?.toLocaleString() ?? 0}
              sub={`${totals.warm ?? 0} warm · ${totals.cold ?? 0} cold`}
              icon={Target} color="bg-red-100 text-red-600 dark:bg-red-950"
            />
            <StatCard
              title="Total Ad Spend" value={`₦${Number(totals.totalAdSpend || 0).toLocaleString()}`}
              sub={totals.converted > 0
                ? `₦${(totals.totalAdSpend / totals.converted).toFixed(0)} per conversion`
                : 'No conversions yet'}
              icon={DollarSign} color="bg-amber-100 text-amber-600 dark:bg-amber-950"
            />
          </div>

          {/* By Source */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Leads by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.bySource?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.bySource.map((row: any) => {
                      const cfg = SOURCE_ICONS[row.source] ?? SOURCE_ICONS.MANUAL;
                      const Icon = cfg.icon;
                      const pct = totals.totalLeads > 0
                        ? ((row.leads / totals.totalLeads) * 100).toFixed(0) : 0;
                      const cr = row.leads > 0
                        ? ((row.converted / row.leads) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={row.source}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={cn('p-1 rounded', cfg.bg)}>
                                <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                              </span>
                              <span className="text-sm font-medium">{row.source}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{row.leads} leads</span>
                              <span className="text-green-600 font-medium">{cr}% CVR</span>
                              {row.totalCost > 0 && (
                                <span>₦{Number(row.totalCost).toLocaleString()} spend</span>
                              )}
                            </div>
                          </div>
                          <div className="bg-muted rounded-full h-1.5">
                            <div
                              className={cn('h-1.5 rounded-full', cfg.bg.replace('100', '500').replace('bg-', 'bg-'))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Pipeline Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.byStatus?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.byStatus.map((row: any) => (
                      <div key={row.status} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{row.status?.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-muted rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${totals.totalLeads > 0 ? (row.count / totals.totalLeads * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-8 text-right">{row.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* By Campaign */}
          {data?.byCampaign?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Campaign</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Leads</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Converted</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">CVR</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ad Spend</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">CPL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCampaign.map((c: any) => {
                        const cvr = c.leads > 0 ? ((c.converted / c.leads) * 100).toFixed(1) : '0.0';
                        const cpl = c.leads > 0 && c.totalCost > 0
                          ? (c.totalCost / c.leads).toFixed(0) : null;
                        return (
                          <tr key={c.campaignName} className="border-b hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-medium max-w-[200px] truncate">{c.campaignName}</td>
                            <td className="py-2.5 px-3 text-right">{c.leads}</td>
                            <td className="py-2.5 px-3 text-right text-green-600">{c.converted}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={cn('font-semibold', Number(cvr) > 20 ? 'text-green-600' : Number(cvr) > 10 ? 'text-amber-600' : 'text-red-500')}>
                                {cvr}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {c.totalCost > 0 ? `₦${Number(c.totalCost).toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {cpl ? `₦${Number(cpl).toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staff Performance */}
          {staffData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Staff Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Staff Member</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Total Leads</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Contacted</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Won</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">CVR</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg Reply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffData.map((s: any) => {
                        const cvr = s.totalLeads > 0 ? ((s.won / s.totalLeads) * 100).toFixed(1) : '0.0';
                        const replyMins = Math.round(s.avgReplyMins ?? 0);
                        return (
                          <tr key={s.id} className="border-b hover:bg-muted/20">
                            <td className="py-2.5 px-3">
                              <div>
                                <p className="font-medium">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.email}</p>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">{s.totalLeads}</td>
                            <td className="py-2.5 px-3 text-right">{s.contacted}</td>
                            <td className="py-2.5 px-3 text-right text-green-600 font-medium">{s.won}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={cn('font-semibold', Number(cvr) > 20 ? 'text-green-600' : 'text-muted-foreground')}>
                                {cvr}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              <span className={cn(
                                'flex items-center justify-end gap-1 text-xs',
                                replyMins < 5 ? 'text-green-600' : replyMins < 60 ? 'text-amber-600' : 'text-red-500',
                              )}>
                                <Clock className="h-3 w-3" />
                                {replyMins === 0 ? '—' : replyMins < 60 ? `${replyMins}m` : `${Math.round(replyMins/60)}h`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily Trend */}
          {data?.daily?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Daily Lead Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {(() => {
                    const max = Math.max(...data.daily.map((d: any) => d.leads), 1);
                    return data.daily.slice(-30).map((d: any) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                        <div
                          className="w-full bg-primary/80 rounded-sm hover:bg-primary transition-colors"
                          style={{ height: `${(d.leads / max) * 100}%`, minHeight: d.leads > 0 ? '4px' : '0' }}
                          title={`${d.date}: ${d.leads} leads`}
                        />
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">Last 30 days</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
