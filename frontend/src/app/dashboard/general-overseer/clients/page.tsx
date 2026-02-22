'use client';

import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Search, Loader2, Mail, Phone, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function GOClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res: any = await api.get(`/clients?${params}`);
      const inner = res?.data ?? res;
      setClients(Array.isArray(inner) ? inner : (inner?.data ?? []));
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">Overview of all clients on the platform</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">{clients.length} total</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            All Clients
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">No clients found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium">Properties Owned</th>
                    <th className="pb-3 font-medium">Total Spent</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.map((c: any) => {
                    const user = c.user ?? c;
                    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown';
                    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              {user.avatar ? <img src={user.avatar} alt={name} className="w-full h-full object-cover rounded-full" /> : null}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-sm">{name}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {user.email ?? '—'}
                          </p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {user.phone}
                            </p>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Home className="w-4 h-4 text-primary" />
                            <span className="text-sm">{c.propertiesOwned ?? c._count?.ownedProperties ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-3 text-sm font-medium text-primary">
                          {formatCurrency(c.totalSpent ?? 0)}
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {user.createdAt ? formatDate(user.createdAt) : '—'}
                        </td>
                        <td className="py-3">
                          <Badge variant={user.isActive !== false ? 'success' : 'secondary'}>
                            {user.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
