'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardList, CalendarDays, BarChart3,
  Users, CheckCircle, Clock, ArrowRight, Loader2,
} from 'lucide-react';
import { NairaSign } from '@/components/icons/naira-sign';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function GOHRPage() {
  const [summary, setSummary] = useState<any>(null);
  const [recentLeaves, setRecentLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [leaveRes, staffRes]: any[] = await Promise.allSettled([
          api.get('/hr/leave?limit=5'),
          api.get('/staff?limit=100'),
        ]);
        if (leaveRes.status === 'fulfilled') {
          const inner = leaveRes.value?.data ?? leaveRes.value;
          const arr = Array.isArray(inner) ? inner : (inner?.data ?? []);
          setRecentLeaves(arr.slice(0, 5));
          setSummary({
            pendingLeave: arr.filter((l: any) => l.status === 'PENDING').length,
            approvedLeave: arr.filter((l: any) => l.status === 'APPROVED').length,
          });
        }
        if (staffRes.status === 'fulfilled') {
          const inner = staffRes.value?.data ?? staffRes.value;
          const arr = Array.isArray(inner) ? inner : (inner?.data ?? []);
          setSummary((prev: any) => ({
            ...prev,
            totalStaff: arr.length,
            activeStaff: arr.filter((s: any) => s.isActive !== false).length,
          }));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const hrLinks = [
    { label: 'Leave Requests', href: '/dashboard/general-overseer/leave', icon: CalendarDays, desc: 'Review and approve leave requests' },
    { label: 'Staff Directory', href: '/dashboard/general-overseer/staff', icon: Users, desc: 'View all staff members' },
  ];

  const getLeaveStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case 'PENDING': return <Badge className="bg-orange-100 text-orange-700">Pending</Badge>;
      case 'REJECTED': return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR Overview</h1>
        <p className="text-sm text-muted-foreground">Human Resources summary and quick access</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Staff</span>
            </div>
            <p className="text-2xl font-bold">{summary?.totalStaff ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Active Staff</span>
            </div>
            <p className="text-2xl font-bold">{summary?.activeStaff ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Pending Leaves</span>
            </div>
            <p className="text-2xl font-bold">{summary?.pendingLeave ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Approved Leaves</span>
            </div>
            <p className="text-2xl font-bold">{summary?.approvedLeave ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-2 gap-4">
        {hrLinks.map(link => (
          <Link key={link.label} href={link.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{link.label}</h3>
                    <p className="text-sm text-muted-foreground">{link.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent leave requests */}
      {recentLeaves.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Recent Leave Requests
            </CardTitle>
            <Link href="/dashboard/general-overseer/leave" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLeaves.map((leave: any, i: number) => {
                const user = leave.user ?? leave.staff?.user;
                const name = user ? `${user.firstName} ${user.lastName}` : (leave.staffName ?? 'Unknown');
                return (
                  <div key={leave.id ?? i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {leave.leaveType ?? leave.type ?? 'Leave'} •{' '}
                        {leave.startDate ? formatDate(leave.startDate) : ''} – {leave.endDate ? formatDate(leave.endDate) : ''}
                      </p>
                    </div>
                    {getLeaveStatusBadge(leave.status)}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
