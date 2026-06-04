'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  RefreshCw, Flame, Thermometer, Snowflake, Phone, Calendar,
  Facebook, Instagram, Globe, MessageCircle, GripVertical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const STAGES = [
  { id: 'NEW',           label: 'New Leads',      color: 'border-t-blue-500',    count_color: 'bg-blue-100 text-blue-700' },
  { id: 'CONTACTED',     label: 'Contacted',       color: 'border-t-amber-500',   count_color: 'bg-amber-100 text-amber-700' },
  { id: 'QUALIFIED',     label: 'Qualified',       color: 'border-t-purple-500',  count_color: 'bg-purple-100 text-purple-700' },
  { id: 'PROPOSAL_SENT', label: 'Proposal Sent',   color: 'border-t-cyan-500',    count_color: 'bg-cyan-100 text-cyan-700' },
  { id: 'NEGOTIATION',   label: 'Negotiation',     color: 'border-t-orange-500',  count_color: 'bg-orange-100 text-orange-700' },
  { id: 'WON',           label: 'Won ✓',           color: 'border-t-green-500',   count_color: 'bg-green-100 text-green-700' },
  { id: 'LOST',          label: 'Lost',            color: 'border-t-red-400',     count_color: 'bg-red-100 text-red-700' },
];

const SOURCE_ICONS: Record<string, { icon: any; color: string }> = {
  FACEBOOK:  { icon: Facebook,       color: 'text-blue-500' },
  INSTAGRAM: { icon: Instagram,      color: 'text-pink-500' },
  GOOGLE:    { icon: Globe,          color: 'text-green-500' },
  WEBSITE:   { icon: Globe,          color: 'text-indigo-500' },
  WHATSAPP:  { icon: MessageCircle,  color: 'text-emerald-500' },
  MESSENGER: { icon: MessageCircle,  color: 'text-blue-400' },
};

const SCORE_CONFIG = {
  HOT:  { icon: Flame,         color: 'text-red-500' },
  WARM: { icon: Thermometer,   color: 'text-amber-500' },
  COLD: { icon: Snowflake,     color: 'text-blue-400' },
};

function LeadCard({ lead, onDragStart }: { lead: any; onDragStart: (e: React.DragEvent, lead: any) => void }) {
  const sourceCfg = SOURCE_ICONS[lead.source] ?? { icon: Globe, color: 'text-muted-foreground' };
  const SourceIcon = sourceCfg.icon;
  const scoreCfg = SCORE_CONFIG[lead.score as keyof typeof SCORE_CONFIG] ?? SCORE_CONFIG.COLD;
  const ScoreIcon = scoreCfg.icon;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/dashboard/admin/crm/leads/${lead.id}`} className="hover:underline">
          <p className="text-sm font-medium leading-tight line-clamp-1">{lead.name}</p>
        </Link>
        <ScoreIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', scoreCfg.color)} />
      </div>

      {lead.phone && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          {lead.phone}
        </div>
      )}

      {lead.campaignName && (
        <p className="text-xs text-muted-foreground mt-1 truncate italic">
          {lead.campaignName}
        </p>
      )}

      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1">
          <SourceIcon className={cn('h-3 w-3', sourceCfg.color)} />
          <span className="text-xs text-muted-foreground">{lead.source}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(lead.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      {lead.assignedToName && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px]">
              {(lead.assignedToName || 'U').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{lead.assignedToName}</span>
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragLead = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/leads/pipeline');
      setBoard(data);
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDragStart = (e: React.DragEvent, lead: any) => {
    dragLead.current = lead;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (stageId: string) => {
    const lead = dragLead.current;
    if (!lead || lead.status === stageId) { setDragOver(null); return; }

    // Optimistic update
    setBoard((prev) => {
      const next = { ...prev };
      if (next[lead.status]) {
        next[lead.status] = next[lead.status].filter((l) => l.id !== lead.id);
      }
      next[stageId] = [{ ...lead, status: stageId }, ...(next[stageId] ?? [])];
      return next;
    });
    setDragOver(null);
    dragLead.current = null;

    await api.patch(`/leads/${lead.id}/status`, { status: stageId }).catch(() => load());
  };

  const totalLeads = Object.values(board).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLeads} leads · Drag cards to change stage
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/admin/crm/leads">All Leads</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s.id} className="w-64 shrink-0 bg-muted rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-1 px-1">
          {STAGES.map((stage) => {
            const cards = board[stage.id] ?? [];
            return (
              <div
                key={stage.id}
                className={cn(
                  'w-64 shrink-0 rounded-xl border-t-4 bg-muted/30 dark:bg-muted/10 flex flex-col',
                  stage.color,
                  dragOver === stage.id ? 'ring-2 ring-primary ring-offset-1' : '',
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Column Header */}
                <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', stage.count_color)}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2 min-h-[200px] max-h-[70vh]">
                  {cards.length === 0 ? (
                    <div className="h-20 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                      Drop here
                    </div>
                  ) : (
                    cards.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
