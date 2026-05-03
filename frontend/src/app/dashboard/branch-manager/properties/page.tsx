'use client';

import { useState, useEffect } from 'react';
import { Home, Search, Plus, Filter, Loader2, ArrowRightLeft, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { toast } from 'sonner';
import Link from 'next/link';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:      'bg-green-100 text-green-700',
  SOLD:           'bg-gray-100 text-gray-600',
  PENDING:        'bg-yellow-100 text-yellow-700',
  LISTED:         'bg-blue-100 text-blue-700',
  OFF_MARKET:     'bg-red-100 text-red-600',
  UNDER_CONTRACT: 'bg-orange-100 text-orange-700',
};

export default function BranchPropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [branches, setBranches]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('ALL');
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedProp, setSelectedProp] = useState<any>(null);
  const [toBranchId, setToBranchId]     = useState('');
  const [reason, setReason]             = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const user = getUser();

  const load = async () => {
    setLoading(true);
    try {
      const branchId = user?.branchId;
      const [propsRes, branchesRes] = await Promise.all([
        api.get(`/properties?branchId=${branchId}&limit=100`),
        api.get('/branches?isActive=true'),
      ]);
      setProperties(propsRes?.data ?? propsRes ?? []);
      setBranches((branchesRes ?? []).filter((b: any) => b.id !== branchId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = properties.filter((p) => {
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openTransfer = (prop: any) => {
    setSelectedProp(prop);
    setToBranchId('');
    setReason('');
    setTransferOpen(true);
  };

  const submitTransfer = async () => {
    if (!toBranchId) return toast.error('Please select a target branch');
    setSubmitting(true);
    try {
      await api.post(`/branches/properties/${selectedProp.id}/transfer`, { toBranchId, reason });
      toast.success('Transfer request submitted for approval');
      setTransferOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branch Properties</h1>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <Link href="/dashboard/admin/properties/new">
          <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Add Property</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">No properties found.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((prop) => (
            <Card key={prop.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {prop.images?.[0] && (
                <div className="h-40 overflow-hidden bg-gray-100">
                  <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-1">{prop.title}</h3>
                  <Badge className={`${STATUS_COLORS[prop.status] ?? ''} text-xs shrink-0`}>{prop.status}</Badge>
                </div>
                <p className="text-xs text-gray-400">{prop.city}, {prop.state}</p>
                <p className="text-base font-bold text-primary">{formatCurrency(Number(prop.price))}</p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" asChild>
                    <Link href={`/dashboard/admin/properties`}><Eye className="w-3.5 h-3.5" />View</Link>
                  </Button>
                  {prop.status !== 'SOLD' && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => openTransfer(prop)}>
                      <ArrowRightLeft className="w-3.5 h-3.5" />Transfer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Property to Another Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-500">Property</Label>
              <p className="font-medium text-sm mt-0.5">{selectedProp?.title}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toBranch">Target Branch</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger id="toBranch"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Reason for transfer..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
