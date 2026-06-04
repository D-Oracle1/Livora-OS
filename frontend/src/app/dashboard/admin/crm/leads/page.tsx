'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Search, Filter, Plus, Download, RefreshCw,
  Flame, Thermometer, Snowflake, Facebook, Instagram,
  Globe, MessageCircle, Phone, Mail, Calendar, ChevronDown,
  MoreHorizontal, ArrowUpDown, Eye, Edit, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const SOURCE_ICONS: Record<string, any> = {
  FACEBOOK:  { icon: Facebook,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950' },
  INSTAGRAM: { icon: Instagram,      color: 'text-pink-600',   bg: 'bg-pink-50 dark:bg-pink-950' },
  GOOGLE:    { icon: Globe,          color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950' },
  WEBSITE:   { icon: Globe,          color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
  WHATSAPP:  { icon: MessageCircle,  color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-950' },
  MESSENGER: { icon: MessageCircle,  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950' },
  MANUAL:    { icon: Users,          color: 'text-gray-600',   bg: 'bg-gray-50 dark:bg-gray-900' },
  REFERRAL:  { icon: Users,          color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
};

const STATUS_COLORS: Record<string, string> = {
  NEW:            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONTACTED:      'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  QUALIFIED:      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  PROPOSAL_SENT:  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  NEGOTIATION:    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  WON:            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  LOST:           'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  UNQUALIFIED:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const SCORE_CONFIG = {
  HOT:  { icon: Flame,         color: 'text-red-500',    label: 'Hot' },
  WARM: { icon: Thermometer,   color: 'text-amber-500',  label: 'Warm' },
  COLD: { icon: Snowflake,     color: 'text-blue-400',   label: 'Cold' },
};

function ScoreBadge({ score }: { score: string }) {
  const cfg = SCORE_CONFIG[score as keyof typeof SCORE_CONFIG] ?? SCORE_CONFIG.COLD;
  const Icon = cfg.icon;
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold', cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_ICONS[source] ?? SOURCE_ICONS.MANUAL;
  const Icon = cfg.icon;
  return (
    <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
      <Icon className="h-3 w-3" />
      {source}
    </span>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [source, setSource] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [score,  setScore]  = useState('ALL');

  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: '20',
        ...(search ? { search } : {}),
        ...(source !== 'ALL' ? { source } : {}),
        ...(status !== 'ALL' ? { status } : {}),
        ...(score  !== 'ALL' ? { score }  : {}),
      });
      const data = await api.get(`/leads?${params}`);
      setLeads(data.data ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch { /**/ } finally { setLoading(false); }
  }, [page, search, source, status, score]);

  useEffect(() => { load(); }, [load]);

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    await api.delete(`/leads/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} total leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Link href="/dashboard/admin/crm/integrations">
            <Button variant="outline" size="sm">
              Connect Ads
            </Button>
          </Link>
          <Link href="/dashboard/admin/crm/pipeline">
            <Button variant="outline" size="sm">
              Pipeline
            </Button>
          </Link>
          <Button size="sm" asChild>
            <Link href="/dashboard/admin/crm/leads/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Lead
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, campaign…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-9"
              />
            </div>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="GOOGLE">Google</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="MESSENGER">Messenger</SelectItem>
                <SelectItem value="REFERRAL">Referral</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="QUALIFIED">Qualified</SelectItem>
                <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={score} onValueChange={(v) => { setScore(v); setPage(1); }}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Scores</SelectItem>
                <SelectItem value="HOT">🔥 Hot</SelectItem>
                <SelectItem value="WARM">🌤 Warm</SelectItem>
                <SelectItem value="COLD">❄️ Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No leads found</p>
                    <p className="text-xs mt-1">Connect your ads or add leads manually</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {(lead.name || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{lead.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {lead.phone && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Phone className="h-2.5 w-2.5" />{lead.phone}
                              </span>
                            )}
                            {lead.email && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground truncate max-w-[140px]">
                                <Mail className="h-2.5 w-2.5" />{lead.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={lead.source} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
                        {lead.campaignName || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[lead.status] ?? '')}>
                        {lead.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {lead.assignedToName || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Calendar className="h-3 w-3" />
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/admin/crm/leads/${lead.id}`}>
                              <Eye className="h-3.5 w-3.5 mr-2" />View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteLead(lead.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages} · {total.toLocaleString()} leads
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline" size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >Previous</Button>
              <Button
                variant="outline" size="sm"
                disabled={page === pages}
                onClick={() => setPage((p) => p + 1)}
              >Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
