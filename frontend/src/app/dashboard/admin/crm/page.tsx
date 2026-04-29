'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame, Snowflake, Clock, TrendingUp, Loader2, RefreshCw,
  User, Calendar, MessageSquare, Users, Target, BarChart3,
  Facebook, Instagram, Globe, Zap, ArrowRight, Link2,
  Thermometer, CheckCircle2, DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const SOURCE_COLORS: Record<string, string> = {
  FACEBOOK:  'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  INSTAGRAM: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  GOOGLE:    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  WEBSITE:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  WHATSAPP:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  MESSENGER: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  MANUAL:    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  REFERRAL:  'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

const STATUS_COLORS: Record<string, string> = {
  NEW:            'bg-blue-100 text-blue-800',
  CONTACTED:      'bg-amber-100 text-amber-800',
  QUALIFIED:      'bg-purple-100 text-purple-800',
  PROPOSAL_SENT:  'bg-cyan-100 text-cyan-800',
  NEGOTIATION:    'bg-orange-100 text-orange-800',
  WON:            'bg-green-100 text-green-800',
  LOST:           'bg-red-100 text-red-700',
};

function ScoreDot({ score }: { score: string }) {
  const cls = score === 'HOT' ? 'text-red-500' : score === 'WARM' ? 'text-amber-500' : 'text-blue-400';
  const Icon = score === 'HOT' ? Flame : score === 'WARM' ? Thermometer : Snowflake;
  return <Icon className={cn('h-3.5 w-3.5', cls)} />;
}

const NAV_CARDS = [
  {
    href: '/dashboard/admin/crm/leads',
    title: 'All Leads',
    desc: 'Browse, filter, and manage every lead',
    icon: Users,
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-950',
  },
  {
    href: '/dashboard/admin/crm/pipeline',
    title: 'Pipeline',
    desc: 'Drag-and-drop Kanban sales stages',
    icon: BarChart3,
    color: 'bg-purple-50 text-purple-600 dark:bg-purple-950',
  },
  {
    href: '/dashboard/admin/crm/integrations',
    title: 'Ad Integrations',
    desc: 'Connect Facebook, Instagram, Google',
    icon: Link2,
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-950',
  },
  {
    href: '/dashboard/admin/crm/automation',
    title: 'Automation',
    desc: 'Auto-assign leads with smart rules',
    icon: Zap,
    color: 'bg-green-50 text-green-600 dark:bg-green-950',
  },
  {
    href: '/dashboard/admin/crm/campaigns',
    title: 'Campaign ROI',
    desc: 'Source analytics & staff performance',
    icon: TrendingUp,
    color: 'bg-rose-50 text-rose-600 dark:bg-rose-950',
  },
];

export default function CrmDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, leadsData] = await Promise.all([
        api.get('/leads/reports').catch(() => null),
        api.get('/leads?limit=8').catch(() => null),
      ]);
      setStats(reportsData?.totals ?? null);
      setRecent(leadsData?.data ?? []);
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = stats ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM & Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capture, score, and convert leads from all ad platforms
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Leads',  value: totals.totalLeads ?? 0,  icon: Users,        color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950' },
            { label: 'Hot 🔥',       value: totals.hot ?? 0,          icon: Flame,        color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950' },
            { label: 'Warm 🌤',      value: totals.warm ?? 0,         icon: Thermometer,  color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950' },
            { label: 'Won ✓',       value: totals.converted ?? 0,    icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950' },
            { label: 'Ad Spend',    value: `₦${Number(totals.totalAdSpend || 0).toLocaleString()}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                      <p className="text-xl font-bold mt-1">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                    </div>
                    <div className={cn('p-2 rounded-lg', s.bg)}>
                      <Icon className={cn('h-4 w-4', s.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Nav Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {NAV_CARDS.map((nav) => {
          const Icon = nav.icon;
          return (
            <Link key={nav.href} href={nav.href}>
              <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 h-full">
                <CardContent className="pt-4 pb-4">
                  <div className={cn('p-2.5 rounded-xl w-fit mb-3', nav.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-sm">{nav.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{nav.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Leads */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Leads</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link href="/dashboard/admin/crm/leads">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No leads yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                <Link href="/dashboard/admin/crm/integrations" className="text-primary hover:underline">
                  Connect your ad platforms
                </Link> to start capturing leads automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((lead) => (
                <Link key={lead.id} href={`/dashboard/admin/crm/leads/${lead.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {(lead.name || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <ScoreDot score={lead.score} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.phone || lead.email || 'No contact info'}
                        {lead.campaignName ? ` · ${lead.campaignName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.MANUAL)}>
                        {lead.source}
                      </span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[lead.status] ?? '')}>
                        {lead.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
