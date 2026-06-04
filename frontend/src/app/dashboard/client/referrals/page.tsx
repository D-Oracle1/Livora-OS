'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Link, Users2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';

export default function ClientReferralsPage() {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user?.referralCode) setReferralCode(user.referralCode);
  }, []);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res: any = await api.get('/auth/my-referrals');
        setReferrals(res?.data || []);
      } catch {
        setReferrals([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReferrals();
  }, []);

  const handleCopy = () => {
    const link = `${window.location.origin}/auth/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      CLIENT: 'bg-blue-100 text-blue-700',
      REALTOR: 'bg-green-100 text-green-700',
      STAFF: 'bg-purple-100 text-purple-700',
      ADMIN: 'bg-orange-100 text-orange-700',
    };
    return <Badge className={colors[role] || 'bg-gray-100 text-gray-700'}>{role}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') return <Badge className="bg-green-100 text-green-700">Active</Badge>;
    if (status === 'SUSPENDED') return <Badge className="bg-red-100 text-red-700">Suspended</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Referrals</h1>
        <p className="text-muted-foreground">Track people who signed up using your referral link</p>
      </div>

      {referralCode && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2b1464]/10 flex items-center justify-center">
                  <Link className="w-5 h-5 text-[#2b1464]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Your Referral Link</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/auth/register?ref=${referralCode}` : referralCode}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users2 className="w-5 h-5 text-[#2b1464]" />
            Referral Leads ({referrals.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : referrals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#2b1464] hover:bg-[#2b1464]">
                    <TableHead className="text-white font-semibold">NAME</TableHead>
                    <TableHead className="text-white font-semibold hidden md:table-cell">EMAIL</TableHead>
                    <TableHead className="text-white font-semibold">ROLE</TableHead>
                    <TableHead className="text-white font-semibold">STATUS</TableHead>
                    <TableHead className="text-white font-semibold">JOINED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.firstName} {r.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{r.email}</TableCell>
                      <TableCell>{getRoleBadge(r.role)}</TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No referrals yet</p>
              <p className="text-sm mt-1">Share your referral link to start tracking leads</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
