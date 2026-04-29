'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Save, RefreshCw, CheckCircle2, Settings,
  ArrowRight, User, Users, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Rule {
  id: string;
  name: string;
  conditions: Condition[];
  assignToId: string | null;
  assigneeName?: string;
  mode: string;
  priority: number;
  isActive: boolean;
  triggerCount: number;
}

const FIELD_OPTIONS = [
  { value: 'source',       label: 'Source' },
  { value: 'campaignName', label: 'Campaign Name' },
  { value: 'adName',       label: 'Ad Name' },
  { value: 'city',         label: 'City' },
  { value: 'country',      label: 'Country' },
  { value: 'keyword',      label: 'Keyword' },
  { value: 'platform',     label: 'Platform' },
];

const OPERATOR_OPTIONS = [
  { value: 'contains', label: 'contains' },
  { value: 'equals',   label: 'equals' },
  { value: 'starts',   label: 'starts with' },
];

const MODE_OPTIONS = [
  { value: 'DIRECT',      label: 'Direct Assign',   desc: 'Always assign to the same person' },
  { value: 'ROUND_ROBIN', label: 'Round Robin',      desc: 'Rotate assignments across team members' },
  { value: 'LOAD_BALANCE',label: 'Load Balance',     desc: 'Assign to the person with fewest leads' },
];

const EMPTY_RULE = {
  name: '', conditions: [{ field: 'campaignName', operator: 'contains', value: '' }],
  assignToId: '', mode: 'DIRECT', priority: 0,
};

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { load(); loadStaff(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/leads/assignment-rules');
      setRules(Array.isArray(data) ? data : []);
    } catch { /**/ } finally { setLoading(false); }
  };

  const loadStaff = async () => {
    try {
      const data = await api.get('/staff?limit=100');
      setStaff(data.data ?? []);
    } catch { /**/ }
  };

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 3500);
  };

  const openCreate = () => { setEditingRule({ ...EMPTY_RULE }); setOpen(true); };
  const openEdit = (rule: Rule) => {
    setEditingRule({
      id: rule.id, name: rule.name,
      conditions: rule.conditions?.length ? rule.conditions : [{ field: 'campaignName', operator: 'contains', value: '' }],
      assignToId: rule.assignToId ?? '',
      mode: rule.mode, priority: rule.priority,
    });
    setOpen(true);
  };

  const saveRule = async () => {
    if (!editingRule.name.trim()) return;
    setSaving(true);
    try {
      if (editingRule.id) {
        await api.patch(`/leads/assignment-rules/${editingRule.id}`, editingRule);
      } else {
        await api.post('/leads/assignment-rules', editingRule);
      }
      setOpen(false);
      load();
      showToast('Rule saved successfully');
    } catch (e: any) { showToast(e.message); }
    finally { setSaving(false); }
  };

  const toggleRule = async (rule: Rule) => {
    await api.patch(`/leads/assignment-rules/${rule.id}`, { isActive: !rule.isActive });
    load();
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await api.delete(`/leads/assignment-rules/${id}`);
    load();
    showToast('Rule deleted');
  };

  const addCondition = () => {
    setEditingRule((prev: any) => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'campaignName', operator: 'contains', value: '' }],
    }));
  };

  const removeCondition = (idx: number) => {
    setEditingRule((prev: any) => ({
      ...prev,
      conditions: prev.conditions.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateCondition = (idx: number, key: string, val: string) => {
    setEditingRule((prev: any) => {
      const conds = [...prev.conditions];
      conds[idx] = { ...conds[idx], [key]: val };
      return { ...prev, conditions: conds };
    });
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm font-medium shadow flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />{toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignment Automation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically assign leads to sales reps based on campaign, source, or location rules
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />New Rule
        </Button>
      </div>

      {/* Mode explainers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODE_OPTIONS.map((m) => (
          <Card key={m.value} className="border-dashed">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Settings className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">No automation rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create rules to auto-assign leads to your sales team</p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={cn(!rule.isActive && 'opacity-60')}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{rule.name}</p>
                      <Badge variant="outline" className="text-xs">{rule.mode.replace(/_/g, ' ')}</Badge>
                      {!rule.isActive && <Badge variant="secondary" className="text-xs">Paused</Badge>}
                      {rule.triggerCount > 0 && (
                        <span className="text-xs text-muted-foreground">· {rule.triggerCount} triggers</span>
                      )}
                    </div>

                    {rule.conditions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rule.conditions.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-md">
                            <span className="font-medium">{c.field}</span>
                            <span className="text-muted-foreground">{c.operator}</span>
                            <span className="font-medium">&quot;{c.value}&quot;</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {rule.assigneeName && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        <User className="h-3 w-3" />
                        Assign to <span className="font-medium text-foreground">{rule.assigneeName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleRule(rule)}>
                      {rule.isActive
                        ? <ToggleRight className="h-4 w-4 text-green-500" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      }
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule.id ? 'Edit Rule' : 'New Assignment Rule'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <Label>Rule Name</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Real Estate Leads → Property Team"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Conditions (ALL must match)</Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
              <div className="space-y-2">
                {editingRule.conditions?.map((c: Condition, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={c.field} onValueChange={(v) => updateCondition(i, 'field', v)}>
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={(v) => updateCondition(i, 'operator', v)}>
                      <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 text-xs flex-1"
                      placeholder="value"
                      value={c.value}
                      onChange={(e) => updateCondition(i, 'value', e.target.value)}
                    />
                    {editingRule.conditions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeCondition(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label>Assignment Mode</Label>
              <Select
                value={editingRule.mode}
                onValueChange={(v) => setEditingRule({ ...editingRule, mode: v })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} — <span className="text-muted-foreground text-xs">{m.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingRule.mode === 'DIRECT' && (
              <div>
                <Label>Assign To</Label>
                <Select
                  value={editingRule.assignToId ?? 'none'}
                  onValueChange={(v) => setEditingRule({ ...editingRule, assignToId: v === 'none' ? null : v })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select —</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.userId} value={s.userId}>
                        {s.user?.firstName} {s.user?.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Priority (higher = checked first)</Label>
              <Input
                type="number" min={0} max={100}
                className="mt-1.5"
                value={editingRule.priority ?? 0}
                onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveRule} disabled={saving || !editingRule.name.trim()}>
              {saving ? 'Saving…' : 'Save Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
