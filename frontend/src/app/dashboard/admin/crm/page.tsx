'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame,
  Snowflake,
  Clock,
  TrendingUp,
  Loader2,
  RefreshCw,
  User,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getImageUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LeadProfile {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  realtor: {
    id: string;
    user: { id: string; firstName: string; lastName: string };
  } | null;
  engagementScore: number;
  lastContactedAt: string | null;
  lastMessageSnippet: string | null;
  daysSinceContact: number | null;
  totalPurchaseValue: number | null;
}

function getInitials(first?: string, last?: string) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';
}

function scoreColor(score: number) {
  if (score >= 60) return 'text-green-600 dark:text-green-400';
  if (score >= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all',
            score >= 60 ? 'bg-green-500' : score >= 30 ? 'bg-amber-500' : 'bg-gray-400',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-xs font-mono font-semibold tabular-nums', scoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadProfile }) {
  const daysSince = lead.daysSinceContact;

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <Avatar className="h-9 w-9 shrink-0">
        {lead.user.avatar && <AvatarImage src={getImageUrl(lead.user.avatar)} />}
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {getInitials(lead.user.firstName, lead.user.lastName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {lead.user.firstName} {lead.user.lastName}
          </p>
          {lead.realtor && (
            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
              via {lead.realtor.user.firstName}
            </span>
          )}
        </div>
        {lead.lastMessageSnippet ? (
          <p className="text-xs text-muted-foreground truncate">{lead.lastMessageSnippet}</p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">No recent message</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <ScoreBar score={lead.engagementScore} />
        {daysSince !== null ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">Never contacted</span>
        )}
      </div>
    </div>
  );
}

function LeadList({
  leads,
  loading,
  empty,
}: {
  leads: LeadProfile[];
  loading: boolean;
  empty: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">{empty}</p>;
  }
  return (
    <div>
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

export default function CrmPage() {
  const [hotLeads, setHotLeads] = useState<LeadProfile[]>([]);
  const [coldLeads, setColdLeads] = useState<LeadProfile[]>([]);
  const [followUps, setFollowUps] = useState<LeadProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [hot, cold, pending] = await Promise.all([
        api.get<any>('/chat/crm/hot-leads?limit=30'),
        api.get<any>('/chat/crm/cold-leads?limit=30'),
        api.get<any>('/chat/crm/follow-ups?limit=30'),
      ]);

      const unwrap = (res: any): LeadProfile[] => {
        const d = res?.data ?? res;
        return Array.isArray(d) ? d : [];
      };

      setHotLeads(unwrap(hot));
      setColdLeads(unwrap(cold));
      setFollowUps(unwrap(pending));
    } catch {
      // silently fail — data may not exist yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = [
    {
      label: 'Hot Leads',
      value: hotLeads.length,
      icon: Flame,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      desc: 'High engagement, contacted recently',
    },
    {
      label: 'Follow-ups Due',
      value: followUps.length,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      desc: 'Warm window: 3–13 days since contact',
    },
    {
      label: 'Cold Leads',
      value: coldLeads.length,
      icon: Snowflake,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      desc: 'No contact in 14+ days or low engagement',
    },
    {
      label: 'Avg. Score',
      value:
        hotLeads.length > 0
          ? Math.round(hotLeads.reduce((s, l) => s + l.engagementScore, 0) / hotLeads.length)
          : 0,
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950/20',
      desc: 'Average engagement score of hot leads',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lead tracking, engagement scoring, and follow-up management
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug hidden sm:block">
                    {s.desc}
                  </p>
                </div>
                <div className={cn('p-2 rounded-lg', s.bg)}>
                  <s.icon className={cn('w-5 h-5', s.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lead tabs */}
      <Tabs defaultValue="hot">
        <TabsList>
          <TabsTrigger value="hot" className="gap-2">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            Hot Leads
            {hotLeads.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                {hotLeads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Follow-ups
            {followUps.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                {followUps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cold" className="gap-2">
            <Snowflake className="w-3.5 h-3.5 text-blue-500" />
            Cold Leads
            {coldLeads.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                {coldLeads.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hot">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Hot Leads
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  Score ≥ 30 · contacted in last 7 days
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadList
                leads={hotLeads}
                loading={loading}
                empty="No hot leads right now — keep engaging with clients!"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Follow-ups
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  3–13 days since last contact
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadList
                leads={followUps}
                loading={loading}
                empty="No pending follow-ups — your engagement is on point!"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cold">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-blue-500" />
                Cold Leads
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  14+ days without contact or score &lt; 10
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadList
                leads={coldLeads}
                loading={loading}
                empty="No cold leads — all clients are being engaged!"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
