'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Loader2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import Link from 'next/link';

const ROLE_COLORS: Record<string, string> = {
  ADMIN:          'bg-purple-100 text-purple-700',
  BRANCH_MANAGER: 'bg-indigo-100 text-indigo-700',
  REALTOR:        'bg-blue-100 text-blue-700',
  HR:             'bg-orange-100 text-orange-700',
  STAFF:          'bg-gray-100 text-gray-600',
  CLIENT:         'bg-teal-100 text-teal-600',
};

export default function BranchStaffPage() {
  const [users, setUsers]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const user = getUser();

  const load = async () => {
    setLoading(true);
    try {
      const branchId = user?.branchId;
      const res = await api.get(`/users?branchId=${branchId}&limit=200`);
      setUsers(res?.data ?? res ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) =>
    !search ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleGroups = Object.keys(ROLE_COLORS).map(role => ({
    role,
    count: users.filter(u => u.role === role).length,
  })).filter(g => g.count > 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branch Staff</h1>
          <Badge variant="secondary">{users.length}</Badge>
        </div>
        <Link href="/dashboard/admin/staff">
          <Button size="sm" className="gap-1.5"><UserPlus className="w-4 h-4" />Manage Staff</Button>
        </Link>
      </div>

      {/* Role breakdown */}
      <div className="flex flex-wrap gap-2">
        {roleGroups.map(({ role, count }) => (
          <div key={role} className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100'}`}>
            {role.replace('_', ' ')} ({count})
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">No staff found.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((u) => (
            <Card key={u.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={u.avatar} alt={`${u.firstName} ${u.lastName}`} />
                  <AvatarFallback>{u.firstName?.[0]}{u.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {u.firstName} {u.lastName}
                    </span>
                    <Badge className={`text-xs ${ROLE_COLORS[u.role] ?? ''}`}>{u.role}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${u.status === 'ACTIVE' ? 'border-green-400 text-green-600' : 'border-red-300 text-red-500'}`}
                >
                  {u.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
