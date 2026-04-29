'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Flame, Thermometer,
  Snowflake, Facebook, Instagram, Globe, MessageCircle, User,
  Clock, PlusCircle, Save, ChevronDown, Tag, TrendingUp,
  AlertCircle, CheckCircle2, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const STATUS_LIST = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'UNQUALIFIED',
];

const STATUS_COLORS: Record<string, string> = {
  NEW:            'bg-blue-100 text-blue-800',
  CONTACTED:      'bg-amber-100 text-amber-800',
  QUALIFIED:      'bg-purple-100 text-purple-800',
  PROPOSAL_SENT:  'bg-cyan-100 text-cyan-800',
  NEGOTIATION:    'bg-orange-100 text-orange-800',
  WON:            'bg-green-100 text-green-800',
  LOST:           'bg-red-100 text-red-800',
  UNQUALIFIED:    'bg-gray-100 text-gray-600',
};

const SOURCE_META: Record<string, { label: string; color: string }> = {
  FACEBOOK:  { label: 'Facebook Ads', color: 'text-blue-600' },
  INSTAGRAM: { label: 'Instagram Ads', color: 'text-pink-600' },
  GOOGLE:    { label: 'Google Ads',   color: 'text-green-600' },
  WEBSITE:   { label: 'Website Form', color: 'text-indigo-600' },
  WHATSAPP:  { label: 'WhatsApp',     color: 'text-emerald-600' },
  MESSENGER: { label: 'Messenger',    color: 'text-blue-500' },
  MANUAL:    { label: 'Manual Entry', color: 'text-gray-600' },
  REFERRAL:  { label: 'Referral',     color: 'text-purple-600' },
};

const EVENT_ICONS: Record<string, any> = {
  CREATED:        { icon: PlusCircle,   color: 'text-blue-500' },
  STATUS_CHANGED: { icon: Activity,     color: 'text-amber-500' },
  ASSIGNED:       { icon: User,         color: 'text-purple-500' },
  NOTE_ADDED:     { icon: Tag,          color: 'text-green-500' },
  MERGED:         { icon: TrendingUp,   color: 'text-cyan-500' },
  CONTACTED:      { icon: CheckCircle2, color: 'text-emerald-500' },
};

export default function LeadDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => {
    if (id && id !== 'new') loadLead();
    loadStaff();
  }, [id]);

  const loadLead = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/leads/${id}`);
      setLead(data);
    } catch { router.push('/dashboard/admin/crm/leads'); }
    finally { setLoading(false); }
  };

  const loadStaff = async () => {
    try {
      const data = await api.get('/staff?limit=100');
      setStaff(data.data ?? []);
    } catch { /**/ }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updated = await api.patch(`/leads/${id}/status`, { status: newStatus });
      setLead(updated);
    } finally { setUpdatingStatus(false); }
  };

  const handleAssign = async (userId: string) => {
    const updated = await api.patch(`/leads/${id}`, { assignedToId: userId });
    setLead(updated);
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const updated = await api.post(`/leads/${id}/notes`, { content: noteText });
      setLead(updated);
      setNoteText('');
    } finally { setAddingNote(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!lead) return null;

  const scoreCfg = {
    HOT:  { icon: Flame,       color: 'text-red-500',   label: 'Hot 🔥' },
    WARM: { icon: Thermometer, color: 'text-amber-500', label: 'Warm 🌤' },
    COLD: { icon: Snowflake,   color: 'text-blue-400',  label: 'Cold ❄️' },
  }[lead.score as 'HOT' | 'WARM' | 'COLD'] ?? { icon: Snowflake, color: 'text-blue-400', label: 'Cold' };

  const ScoreIcon = scoreCfg.icon;
  const sourceMeta = SOURCE_META[lead.source] ?? SOURCE_META.MANUAL;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="-ml-1 mt-0.5">
          <Link href="/dashboard/admin/crm/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', STATUS_COLORS[lead.status])}>
              {lead.status?.replace(/_/g, ' ')}
            </span>
            <span className={cn('flex items-center gap-1 text-sm font-semibold', scoreCfg.color)}>
              <ScoreIcon className="h-4 w-4" />
              {scoreCfg.label}
            </span>
          </div>
          <p className={cn('text-sm mt-1 font-medium', sourceMeta.color)}>
            via {sourceMeta.label}
            {lead.campaignName ? ` · ${lead.campaignName}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact Info + Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-sm hover:text-primary transition-colors">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  {lead.phone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-sm hover:text-primary transition-colors break-all">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  {lead.email}
                </a>
              )}
              {(lead.city || lead.country) && (
                <div className="flex items-center gap-2.5 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  {[lead.city, lead.country].filter(Boolean).join(', ')}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                {new Date(lead.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          {/* Status Change */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Pipeline Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={lead.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_LIST.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Assign */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Assigned To</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.assignedToId ? (
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {(lead.assignedToName || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{lead.assignedToName}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">Unassigned</p>
              )}
              <Select
                value={lead.assignedToId ?? 'none'}
                onValueChange={(v) => v !== 'none' && handleAssign(v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Reassign…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.userId} value={s.userId}>
                      {s.user?.firstName} {s.user?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Campaign / Ad Info */}
          {(lead.campaignName || lead.adName || lead.keyword) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.campaignName && (
                  <div><span className="text-muted-foreground">Campaign:</span> {lead.campaignName}</div>
                )}
                {lead.adName && (
                  <div><span className="text-muted-foreground">Ad:</span> {lead.adName}</div>
                )}
                {lead.adGroupName && (
                  <div><span className="text-muted-foreground">Ad Group:</span> {lead.adGroupName}</div>
                )}
                {lead.keyword && (
                  <div><span className="text-muted-foreground">Keyword:</span> {lead.keyword}</div>
                )}
                {lead.costPerLead != null && (
                  <div><span className="text-muted-foreground">CPL:</span> ₦{Number(lead.costPerLead).toLocaleString()}</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Score breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Lead Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', {
                      'bg-red-500': lead.score === 'HOT',
                      'bg-amber-500': lead.score === 'WARM',
                      'bg-blue-400': lead.score === 'COLD',
                    })}
                    style={{ width: `${Math.min((lead.scoreValue ?? 0), 100)}%` }}
                  />
                </div>
                <span className={cn('text-sm font-bold', scoreCfg.color)}>
                  {lead.scoreValue ?? 0}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{scoreCfg.label}</p>
            </CardContent>
          </Card>
        </div>

        {/* Center: Notes */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Add Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Write a note about this lead…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <Button size="sm" onClick={submitNote} disabled={addingNote || !noteText.trim()}>
                {addingNote ? 'Saving…' : 'Add Note'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Notes ({lead.notes?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!lead.notes?.length ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                lead.notes.map((note: any) => (
                  <div key={note.id} className="border rounded-lg p-3 space-y-1">
                    <p className="text-sm">{note.content}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{note.authorName}</span>
                      <span>·</span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Timeline */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {!lead.events?.length ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {lead.events.map((event: any) => {
                    const cfg = EVENT_ICONS[event.eventType] ?? { icon: Activity, color: 'text-muted-foreground' };
                    const Icon = cfg.icon;
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className={cn('mt-0.5 shrink-0', cfg.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Fields */}
          {lead.customFields && Object.keys(lead.customFields).length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Form Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {Object.entries(lead.customFields).map(([k, v]) => (
                  String(v) && (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground capitalize min-w-[100px] shrink-0">
                        {k.replace(/_/g, ' ')}:
                      </span>
                      <span className="break-all">{String(v)}</span>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
