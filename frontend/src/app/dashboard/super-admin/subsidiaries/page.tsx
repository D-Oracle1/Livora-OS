'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Plus, ChevronRight, Globe, Users, TrendingUp,
  Loader2, RefreshCw, CheckCircle, XCircle, Search, Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';

const MASTER_API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

async function masterGet(path: string) {
  const res = await fetch(`${MASTER_API}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error((await res.json())?.message || 'Request failed');
  return res.json();
}

async function masterPost(path: string, body: any) {
  const res = await fetch(`${MASTER_API}/api/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json())?.message || 'Request failed');
  return res.json();
}

interface CompanyNode {
  id: string;
  name: string;
  slug: string;
  domain: string;
  type: 'PARENT' | 'SUBSIDIARY' | 'STANDALONE';
  parentId: string | null;
  isActive: boolean;
  plan: string;
  logo: string | null;
  city: string | null;
  country: string | null;
  subsidiaries?: CompanyNode[];
}

export default function SubsidiariesPage() {
  const [companies, setCompanies] = useState<CompanyNode[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New subsidiary form
  const [form, setForm] = useState({
    name: '', slug: '', domain: '', type: 'SUBSIDIARY' as 'PARENT' | 'SUBSIDIARY' | 'STANDALONE',
    parentId: '', plan: 'standard', country: 'Nigeria', city: '', description: '',
    address: '', phone: '', email: '', registrationNo: '', taxId: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await masterGet('/companies?hierarchy=true');
      setCompanies(data ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const parents = companies.filter(c => c.type === 'PARENT' || c.type === 'STANDALONE');

  const submit = async () => {
    if (!form.name || !form.slug || !form.domain) {
      return toast.error('Name, slug and domain are required');
    }
    setSubmitting(true);
    try {
      await masterPost('/companies', {
        ...form,
        parentId: form.parentId || undefined,
      });
      toast.success('Company created successfully');
      setCreateOpen(false);
      setForm({ name: '', slug: '', domain: '', type: 'SUBSIDIARY', parentId: '', plan: 'standard', country: 'Nigeria', city: '', description: '', address: '', phone: '', email: '', registrationNo: '', taxId: '' });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = companies.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase()) ||
    c.domain.toLowerCase().includes(search.toLowerCase())
  );

  const parents_ = filtered.filter(c => c.type === 'PARENT');
  const standalone = filtered.filter(c => c.type === 'STANDALONE');
  const orphans = filtered.filter(c => c.type === 'SUBSIDIARY' && !c.parentId);

  const TYPE_BADGE: Record<string, string> = {
    PARENT:     'bg-purple-100 text-purple-700',
    SUBSIDIARY: 'bg-blue-100 text-blue-700',
    STANDALONE: 'bg-gray-100 text-gray-600',
  };

  const CompanyCard = ({ company, depth = 0 }: { company: CompanyNode; depth?: number }) => (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-dashed border-gray-200 dark:border-gray-700 pl-4' : ''}>
      <Card className={`mb-3 hover:shadow-md transition-shadow ${!company.isActive ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="w-9 h-9 rounded-md object-cover shrink-0 border" />
              ) : (
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{company.name}</span>
                  <Badge className={`text-xs ${TYPE_BADGE[company.type]}`}>{company.type}</Badge>
                  {!company.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                  <Badge variant="outline" className="text-xs font-mono">{company.plan}</Badge>
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{company.domain}</span>
                  {company.city && <span>{company.city}, {company.country}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {company.isActive
                ? <CheckCircle className="w-4 h-4 text-green-500" />
                : <XCircle className="w-4 h-4 text-red-400" />}
            </div>
          </div>
        </CardContent>
      </Card>
      {company.subsidiaries?.map(sub => (
        <CompanyCard key={sub.id} company={sub} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Hierarchy</h1>
          <Badge variant="secondary">{companies.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />Add Company
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Parent Companies', count: companies.filter(c => c.type === 'PARENT').length, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
          { label: 'Subsidiaries',     count: companies.filter(c => c.type === 'SUBSIDIARY').length, icon: Building, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
          { label: 'Active Total',     count: companies.filter(c => c.isActive).length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..." className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {parents_.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Parent Companies & Subsidiaries</h2>
              {parents_.map(p => <CompanyCard key={p.id} company={p} />)}
            </div>
          )}
          {standalone.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-4">Standalone Companies</h2>
              {standalone.map(c => <CompanyCard key={c.id} company={c} />)}
            </div>
          )}
          {orphans.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-4">Unattached Subsidiaries</h2>
              {orphans.map(c => <CompanyCard key={c.id} company={c} />)}
            </div>
          )}
          {filtered.length === 0 && (
            <Card><CardContent className="py-12 text-center text-gray-500">No companies found.</CardContent></Card>
          )}
        </div>
      )}

      {/* Create Company Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
              </div>
              <div className="space-y-1.5">
                <Label>Slug * (URL-safe)</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} placeholder="acme-corp" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Domain *</Label>
              <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="acme.liveraos.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any, parentId: v !== 'SUBSIDIARY' ? '' : f.parentId }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDALONE">Standalone</SelectItem>
                    <SelectItem value="PARENT">Parent Company</SelectItem>
                    <SelectItem value="SUBSIDIARY">Subsidiary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === 'SUBSIDIARY' && (
              <div className="space-y-1.5">
                <Label>Parent Company</Label>
                <Select value={form.parentId} onValueChange={v => setForm(f => ({ ...f, parentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select parent company" /></SelectTrigger>
                  <SelectContent>
                    {parents.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Lagos" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Business District" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Registration No.</Label>
                <Input value={form.registrationNo} onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tax ID</Label>
                <Input value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief company description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
