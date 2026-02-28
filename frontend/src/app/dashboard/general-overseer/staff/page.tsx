'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCog, Search, Loader2, Mail, Phone, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function GOStaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res: any = await api.get(`/staff?${params}`);
      const inner = res?.data ?? res;
      setStaff(Array.isArray(inner) ? inner : (inner?.data ?? []));
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const active = staff.filter(s => s.isActive !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-sm text-muted-foreground">All staff members across the company</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="px-3 py-1">{staff.length} total</Badge>
          <Badge className="bg-green-100 text-green-700 px-3 py-1">{active} active</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            Staff Members
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
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
          ) : staff.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">No staff members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Role / Position</th>
                    <th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staff.map((s: any) => {
                    const user = s.user ?? s;
                    const name = s.fullName ?? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown');
                    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-sm">{name}</p>
                          </div>
                        </td>
                        <td className="py-3 text-sm">{s.position ?? s.jobTitle ?? '—'}</td>
                        <td className="py-3">
                          {s.department ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              {s.department?.name ?? s.department}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="py-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {s.email ?? user.email ?? '—'}
                          </p>
                          {(s.phone ?? user.phone) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {s.phone ?? user.phone}
                            </p>
                          )}
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {s.startDate ? formatDate(s.startDate) : (s.createdAt ? formatDate(s.createdAt) : '—')}
                        </td>
                        <td className="py-3">
                          <Badge variant={s.isActive !== false ? 'success' : 'secondary'}>
                            {s.isActive !== false ? 'Active' : 'Inactive'}
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
