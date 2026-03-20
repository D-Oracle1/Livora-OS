'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Plus,
  Send,
  Trash2,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Copy,
  Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RaffleSession {
  id: string;
  name: string;
  description?: string;
  codePrefix: string;
  codeLength: number;
  status: 'DRAFT' | 'SENT' | 'COMPLETED';
  targetRoles: string[];
  joinedAfter?: string;
  joinedBefore?: string;
  sentAt?: string;
  totalSent: number;
  createdAt: string;
  _count?: { codes: number };
}

interface RaffleCode {
  id: string;
  code: string;
  sentAt?: string;
  redeemedAt?: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
}

interface EligiblePreview {
  count: number;
  sample: Array<{ id: string; firstName: string; lastName: string; email: string; role: string; createdAt: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES = ['CLIENT', 'REALTOR', 'STAFF', 'HR', 'ADMIN', 'GENERAL_OVERSEER'] as const;

const ROLE_COLORS: Record<string, string> = {
  CLIENT: 'bg-orange-100 text-orange-700',
  REALTOR: 'bg-emerald-100 text-emerald-700',
  STAFF: 'bg-gray-100 text-gray-700',
  HR: 'bg-teal-100 text-teal-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  GENERAL_OVERSEER: 'bg-purple-100 text-purple-700',
};

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  SENT: { label: 'Sent', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  COMPLETED: { label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: Trophy },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CodePreview({ prefix, length }: { prefix: string; length: number }) {
  const example = `${(prefix || 'RAFFLE').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'RAFFLE'}-${'X'.repeat(length)}`;
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Preview:</span>
      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono font-semibold tracking-wider">{example}</code>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RafflePage() {
  const [sessions, setSessions] = useState<RaffleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSession, setActiveSession] = useState<RaffleSession | null>(null);
  const [codes, setCodes] = useState<RaffleCode[]>([]);
  const [codesMeta, setCodesMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [codesLoading, setCodesLoading] = useState(false);
  const [preview, setPreview] = useState<EligiblePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    codePrefix: 'RAFFLE',
    codeLength: 6,
    targetRoles: [] as string[],
    joinedAfter: '',
    joinedBefore: '',
  });
  const [creating, setCreating] = useState(false);

  // ── Fetch sessions ───────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/raffle');
      const raw = res?.data ?? res;
      setSessions(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load raffle sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Fetch codes ──────────────────────────────────────────────────────────

  const fetchCodes = useCallback(async (sessionId: string, page = 1) => {
    setCodesLoading(true);
    try {
      const res = await api.get<any>(`/raffle/${sessionId}/codes?page=${page}&limit=20`);
      const raw = res?.data ?? res;
      setCodes(Array.isArray(raw?.data) ? raw.data : []);
      setCodesMeta({
        page: raw?.meta?.page ?? 1,
        totalPages: raw?.meta?.totalPages ?? 1,
        total: raw?.meta?.total ?? 0,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load codes');
    } finally {
      setCodesLoading(false);
    }
  }, []);

  // ── Open session detail ──────────────────────────────────────────────────

  const openSession = async (session: RaffleSession) => {
    setActiveSession(session);
    setPreview(null);
    setCodes([]);
    await fetchCodes(session.id, 1);
    // Also load preview count
    try {
      const res = await api.get<any>(`/raffle/${session.id}/preview`);
      const raw = res?.data ?? res;
      setPreview(raw);
    } catch { /* silent */ }
  };

  // ── Create session ───────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Please enter a session name');
    if (form.targetRoles.length === 0) return toast.error('Select at least one role');

    setCreating(true);
    try {
      const res = await api.post<any>('/raffle', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        codePrefix: form.codePrefix.trim() || 'RAFFLE',
        codeLength: form.codeLength,
        targetRoles: form.targetRoles,
        joinedAfter: form.joinedAfter || undefined,
        joinedBefore: form.joinedBefore || undefined,
      });
      toast.success('Raffle session created');
      setShowCreate(false);
      setForm({ name: '', description: '', codePrefix: 'RAFFLE', codeLength: 6, targetRoles: [], joinedAfter: '', joinedBefore: '' });
      fetchSessions();
      // Open the new session
      const newSession = res?.data ?? res;
      if (newSession?.id) openSession({ ...newSession, _count: { codes: 0 } });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  // ── Preview eligible ─────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!activeSession) return;
    setPreviewing(true);
    try {
      const res = await api.get<any>(`/raffle/${activeSession.id}/preview`);
      const raw = res?.data ?? res;
      setPreview(raw);
    } catch (err: any) {
      toast.error(err.message || 'Failed to preview');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Send codes ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!activeSession) return;
    setSending(true);
    const toastId = toast.loading('Generating and sending codes…');
    try {
      const res = await api.post<any>(`/raffle/${activeSession.id}/send`);
      const raw = res?.data ?? res;
      toast.success(`${raw?.sent ?? 'All'} codes sent successfully!`, { id: toastId });
      fetchSessions();
      await fetchCodes(activeSession.id, 1);
      setActiveSession((prev) => prev ? { ...prev, status: 'SENT', totalSent: raw?.sent ?? prev.totalSent } : prev);
      setPreview(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send codes', { id: toastId });
    } finally {
      setSending(false);
    }
  };

  // ── Complete session ─────────────────────────────────────────────────────

  const handleComplete = async (id: string) => {
    setCompleting(id);
    try {
      await api.patch(`/raffle/${id}/complete`);
      toast.success('Session marked as completed');
      fetchSessions();
      if (activeSession?.id === id) {
        setActiveSession((prev) => prev ? { ...prev, status: 'COMPLETED' } : prev);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete session');
    } finally {
      setCompleting(null);
    }
  };

  // ── Delete session ───────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/raffle/${id}`);
      toast.success('Raffle session deleted');
      fetchSessions();
      if (activeSession?.id === id) setActiveSession(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  // ── Toggle role ──────────────────────────────────────────────────────────

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      targetRoles: f.targetRoles.includes(role)
        ? f.targetRoles.filter((r) => r !== role)
        : [...f.targetRoles, role],
    }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: Session list */}
      <div className={`flex flex-col border-r border-border transition-all duration-200 ${activeSession ? 'hidden md:flex md:w-80 lg:w-96' : 'w-full md:w-80 lg:w-96'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              Raffle Manager
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={fetchSessions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
              <Ticket className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No raffle sessions yet</p>
              <Button size="sm" onClick={() => setShowCreate(true)}>Create one</Button>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {sessions.map((session) => {
                const cfg = STATUS_CONFIG[session.status];
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => openSession(session)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-sm ${
                      activeSession?.id === session.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-primary/30 bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{session.name}</p>
                        {session.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{session.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {session.targetRoles.slice(0, 3).map((r) => (
                            <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] || 'bg-muted text-muted-foreground'}`}>
                              {r}
                            </span>
                          ))}
                          {session.targetRoles.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              +{session.targetRoles.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        {session._count?.codes ?? session.totalSent} codes
                      </span>
                      <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Session detail */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${!activeSession ? 'hidden md:flex' : 'flex'}`}>
        {!activeSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
            <Ticket className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Select a session to view details</p>
            <Button variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Session
            </Button>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setActiveSession(null)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{activeSession.name}</h2>
                  {activeSession.description && (
                    <p className="text-xs text-muted-foreground truncate">{activeSession.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeSession.status === 'SENT' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1 text-xs"
                    onClick={() => handleComplete(activeSession.id)}
                    disabled={completing === activeSession.id}
                  >
                    {completing === activeSession.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
                    Mark Complete
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(activeSession.id)}
                  disabled={deleting === activeSession.id}
                >
                  {deleting === activeSession.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-primary">{activeSession._count?.codes ?? activeSession.totalSent}</div>
                    <div className="text-xs text-muted-foreground">Codes Issued</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {codes.filter((c) => c.sentAt).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Sent</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {codes.filter((c) => c.redeemedAt).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Redeemed</div>
                  </CardContent>
                </Card>
              </div>

              {/* Config summary */}
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Code Format</p>
                      <code className="font-mono font-semibold tracking-wider text-primary">
                        {activeSession.codePrefix}-{'X'.repeat(activeSession.codeLength)}
                      </code>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Status</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[activeSession.status].color}`}>
                        {STATUS_CONFIG[activeSession.status].label}
                      </span>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Target Roles</p>
                      <div className="flex flex-wrap gap-1">
                        {activeSession.targetRoles.map((r) => (
                          <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] || 'bg-muted text-muted-foreground'}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Join Date Filter</p>
                      <p className="text-xs">
                        {activeSession.joinedAfter
                          ? `From ${new Date(activeSession.joinedAfter).toLocaleDateString()}`
                          : 'No start date'}
                        {' — '}
                        {activeSession.joinedBefore
                          ? `To ${new Date(activeSession.joinedBefore).toLocaleDateString()}`
                          : 'No end date'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Eligible users + send */}
              {activeSession.status === 'DRAFT' && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-medium text-sm">Ready to Send?</p>
                        {preview ? (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground">{preview.count}</span> eligible users found
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Check eligible users before sending</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing} className="gap-1.5">
                          {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                          Preview
                        </Button>
                        <Button size="sm" onClick={handleSend} disabled={sending} className="gap-1.5">
                          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send Codes
                        </Button>
                      </div>
                    </div>

                    {/* Eligible user sample */}
                    {preview && preview.sample.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Sample ({Math.min(preview.sample.length, 10)} of {preview.count})</p>
                        {preview.sample.slice(0, 5).map((u) => (
                          <div key={u.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                            <span className="font-medium">{u.firstName} {u.lastName}</span>
                            <span className="text-muted-foreground flex-1 truncate">{u.email}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[u.role] || 'bg-muted text-muted-foreground'}`}>{u.role}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {preview && preview.count === 0 && (
                      <p className="mt-2 text-sm text-orange-600 font-medium">⚠️ No eligible users match the current filters.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Codes list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">Issued Codes</h3>
                  <Button variant="ghost" size="icon" onClick={() => fetchCodes(activeSession.id, codesMeta.page)} disabled={codesLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${codesLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {codesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : codes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No codes issued yet</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {codes.map((code) => (
                      <div key={code.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs">{code.user.firstName} {code.user.lastName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[code.user.role] || 'bg-muted text-muted-foreground'}`}>
                              {code.user.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{code.user.email}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <code className="text-xs font-mono font-bold tracking-wider bg-muted px-2 py-1 rounded">
                            {code.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => { navigator.clipboard.writeText(code.code); toast.success('Copied!'); }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          {code.redeemedAt ? (
                            <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] shrink-0">
                              Redeemed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] shrink-0">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Codes pagination */}
                {codesMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-xs text-muted-foreground">
                      Page {codesMeta.page} of {codesMeta.totalPages} · {codesMeta.total} codes
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={codesMeta.page <= 1 || codesLoading}
                        onClick={() => { const p = codesMeta.page - 1; setCodesMeta((m) => ({ ...m, page: p })); fetchCodes(activeSession.id, p); }}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={codesMeta.page >= codesMeta.totalPages || codesLoading}
                        onClick={() => { const p = codesMeta.page + 1; setCodesMeta((m) => ({ ...m, page: p })); fetchCodes(activeSession.id, p); }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create session modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-primary" />
                  New Raffle Session
                </h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <form onSubmit={handleCreate} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm font-medium block mb-1">Session Name *</label>
                  <Input
                    placeholder="e.g. Summer 2026 Raffle"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium block mb-1">Description <span className="text-muted-foreground">(optional)</span></label>
                  <Input
                    placeholder="Brief description of the raffle..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                {/* Code format */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Code Prefix *</label>
                    <Input
                      placeholder="e.g. WIN, SUMMER2026"
                      value={form.codePrefix}
                      onChange={(e) => setForm((f) => ({ ...f, codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                      className="font-mono uppercase"
                      maxLength={12}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Code Length</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={4}
                        max={10}
                        value={form.codeLength}
                        onChange={(e) => setForm((f) => ({ ...f, codeLength: Number(e.target.value) }))}
                        className="flex-1"
                      />
                      <span className="w-6 text-center text-sm font-semibold text-primary">{form.codeLength}</span>
                    </div>
                  </div>
                </div>
                <CodePreview prefix={form.codePrefix} length={form.codeLength} />

                {/* Target roles */}
                <div>
                  <label className="text-sm font-medium block mb-2">Target User Roles *</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                          form.targetRoles.includes(role)
                            ? `${ROLE_COLORS[role] || 'bg-primary text-primary-foreground'} border-transparent`
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {role.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  {form.targetRoles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">{form.targetRoles.length} role{form.targetRoles.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>

                {/* Join date filter */}
                <div>
                  <label className="text-sm font-medium block mb-2">Filter by Join Date <span className="text-muted-foreground">(optional)</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Joined After</label>
                      <Input
                        type="date"
                        value={form.joinedAfter}
                        onChange={(e) => setForm((f) => ({ ...f, joinedAfter: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Joined Before</label>
                      <Input
                        type="date"
                        value={form.joinedBefore}
                        onChange={(e) => setForm((f) => ({ ...f, joinedBefore: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to include all users in the selected roles</p>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} className="gap-1.5">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Session
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
