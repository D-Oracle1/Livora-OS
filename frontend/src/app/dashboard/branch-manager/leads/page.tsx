'use client';

import { useState, useEffect } from 'react';
import { UserCheck, Search, Filter, Loader2, PhoneCall, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  NEW:           'bg-blue-100 text-blue-700',
  CONTACTED:     'bg-yellow-100 text-yellow-700',
  QUALIFIED:     'bg-purple-100 text-purple-700',
  PROPOSAL_SENT: 'bg-indigo-100 text-indigo-700',
  NEGOTIATION:   'bg-orange-100 text-orange-700',
  WON:           'bg-green-100 text-green-700',
  LOST:          'bg-red-100 text-red-600',
  UNQUALIFIED:   'bg-gray-100 text-gray-500',
};

export default function BranchLeadsPage() {
  const [leads, setLeads]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('ALL');

  const user = getUser();

  const load = async () => {
    setLoading(true);
    try {
      const branchId = user?.branchId;
      const res = await api.get(`/leads?branchId=${branchId}&limit=200`);
      setLeads(res?.data ?? res ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = leads.filter((l) => {
    const matchSearch = !search ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      l.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pipeline = Object.keys(STATUS_COLORS).map(s => ({
    status: s,
    count:  leads.filter(l => l.status === s).length,
  }));

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branch Leads</h1>
          <Badge variant="secondary">{leads.length}</Badge>
        </div>
        <Link href="/dashboard/admin/crm/leads">
          <Button variant="outline" size="sm">Full CRM</Button>
        </Link>
      </div>

      {/* Pipeline mini-view */}
      <div className="flex flex-wrap gap-2">
        {pipeline.filter(p => p.count > 0).map(({ status, count }) => (
          <button
            key={status}
            onClick={() => setStatus(prev => prev === status ? 'ALL' : status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
              ${statusFilter === status ? 'ring-2 ring-primary ring-offset-1' : ''}
              ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {status.replace('_', ' ')} ({count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, email..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 text-gray-400" />
            <SelectValue />
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
        <Card><CardContent className="py-12 text-center text-gray-500">No leads found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <Card key={lead.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{lead.name}</span>
                    <Badge className={`text-xs ${STATUS_COLORS[lead.status] ?? ''}`}>{lead.status}</Badge>
                    {lead.source && <Badge variant="outline" className="text-xs">{lead.source}</Badge>}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                    {lead.phone && <span className="flex items-center gap-1"><PhoneCall className="w-3 h-3" />{lead.phone}</span>}
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                  </div>
                </div>
                <Link href={`/dashboard/admin/crm/leads/${lead.id}`}>
                  <Button size="sm" variant="outline" className="text-xs">View</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
