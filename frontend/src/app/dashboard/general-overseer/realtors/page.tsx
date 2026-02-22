'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Loader2, Mail, Phone, Star, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatCurrency, getTierBgClass } from '@/lib/utils';

export default function GORealtorsPage() {
  const [realtors, setRealtors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRealtors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res: any = await api.get(`/admin/realtors?${params}`);
      const inner = res?.data ?? res;
      setRealtors(Array.isArray(inner) ? inner : (inner?.data ?? []));
    } catch {
      setRealtors([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchRealtors();
  }, [fetchRealtors]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'text-purple-600';
      case 'GOLD': return 'text-yellow-600';
      case 'SILVER': return 'text-gray-500';
      default: return 'text-orange-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Realtors</h1>
          <p className="text-sm text-muted-foreground">Overview of all realtors on the platform</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {realtors.length} total
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as const).map(tier => {
          const count = realtors.filter(r => r.loyaltyTier === tier).length;
          return (
            <Card key={tier}>
              <CardContent className="p-4 flex items-center gap-3">
                <Star className={`w-5 h-5 ${getTierColor(tier)}`} />
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{tier}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            All Realtors
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search realtors..."
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
          ) : realtors.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">No realtors found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-3 font-medium">Realtor</th>
                    <th className="pb-3 font-medium">Tier</th>
                    <th className="pb-3 font-medium">Sales</th>
                    <th className="pb-3 font-medium">Commission Earned</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {realtors.map((r: any) => {
                    const user = r.user ?? r;
                    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown';
                    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              {user.avatar ? <img src={user.avatar} alt={name} className="w-full h-full object-cover rounded-full" /> : null}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {user.email ?? ''}
                              </p>
                              {user.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {user.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge className={getTierBgClass(r.loyaltyTier ?? 'BRONZE')}>
                            {r.loyaltyTier ?? 'BRONZE'}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">{r.totalSales ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-3 text-sm font-medium text-primary">
                          {formatCurrency(r.totalCommission ?? 0)}
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
