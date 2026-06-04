'use client';

import { useState, useEffect } from 'react';
import { Users2, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';

interface ReferralEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  referrer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    referralCode: string;
  } | null;
}

const ROLE_COLORS: Record<string, string> = {
  CLIENT: 'bg-blue-100 text-blue-700',
  REALTOR: 'bg-green-100 text-green-700',
  STAFF: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-orange-100 text-orange-700',
  GENERAL_OVERSEER: 'bg-amber-100 text-amber-700',
};

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res: any = await api.get('/auth/all-referrals');
        setReferrals(res?.data || []);
      } catch {
        setReferrals([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReferrals();
  }, []);

  const filtered = search.trim()
    ? referrals.filter((r) => {
        const q = search.toLowerCase();
        return (
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.referrer && `${r.referrer.firstName} ${r.referrer.lastName}`.toLowerCase().includes(q)) ||
          (r.referrer?.referralCode?.toLowerCase().includes(q))
        );
      })
    : referrals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Referral Tracking</h1>
          <p className="text-muted-foreground">All users who signed up via referral links</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {referrals.length} total referrals
          </Badge>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users2 className="w-5 h-5 text-[#2b1464]" />
              Referral Leads
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, code..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#2b1464] hover:bg-[#2b1464]">
                    <TableHead className="text-white font-semibold">REFERRED USER</TableHead>
                    <TableHead className="text-white font-semibold hidden md:table-cell">EMAIL</TableHead>
                    <TableHead className="text-white font-semibold">ROLE</TableHead>
                    <TableHead className="text-white font-semibold">REFERRED BY</TableHead>
                    <TableHead className="text-white font-semibold hidden md:table-cell">CODE</TableHead>
                    <TableHead className="text-white font-semibold">STATUS</TableHead>
                    <TableHead className="text-white font-semibold hidden lg:table-cell">JOINED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.firstName} {r.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {r.email}
                      </TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLORS[r.role] || 'bg-gray-100 text-gray-700'}>
                          {r.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.referrer
                          ? `${r.referrer.firstName} ${r.referrer.lastName}`
                          : 'Unknown'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground hidden md:table-cell">
                        {r.referrer?.referralCode || '-'}
                      </TableCell>
                      <TableCell>
                        {r.status === 'ACTIVE' ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge variant="secondary">{r.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {new Date(r.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No referrals found</p>
              <p className="text-sm mt-1">
                {search ? 'Try a different search term' : 'No users have signed up via referral links yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
