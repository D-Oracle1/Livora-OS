'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Clock,
  CalendarDays,
  Star,
  Wallet,
  Users,
  AlertCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Building,
  Shield,
  CheckSquare,
  Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface StaffMember {
  id: string;
  employeeId: string;
  position: string;
  title: string;
  isActive: boolean;
  department: { id: string; name: string } | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
}

interface DepartmentData {
  id: string;
  name: string;
  code: string;
  _count?: { staff: number };
}

interface LeaveRequest {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  staffProfile: {
    user: { firstName: string; lastName: string };
    department: { name: string } | null;
  };
}

interface ReviewData {
  id: string;
  status: string;
  cycle: string;
  reviewee: {
    user: { firstName: string; lastName: string };
  };
}

export default function AdminHrPage() {
  const [loading, setLoading] = useState(true);
  const [totalStaff, setTotalStaff] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [activeReviews, setActiveReviews] = useState<ReviewData[]>([]);
  const [recentStaff, setRecentStaff] = useState<StaffMember[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, deptRes, leaveRes, reviewRes] = await Promise.allSettled([
        api.get<any>('/staff?limit=5&sortBy=createdAt&sortOrder=desc'),
        api.get<any>('/departments'),
        api.get<any>('/hr/leave?status=PENDING&limit=5'),
        api.get<any>('/hr/reviews?status=IN_PROGRESS&limit=5'),
      ]);

      // Staff
      if (staffRes.status === 'fulfilled') {
        const res = staffRes.value;
        const list = Array.isArray(res?.data) ? res.data : [];
        setRecentStaff(list);
        setTotalStaff(res?.meta?.total ?? list.length);
        setActiveStaff(list.filter((s: StaffMember) => s.isActive).length);
      }

      // Departments
      if (deptRes.status === 'fulfilled') {
        const res = deptRes.value;
        setDepartments(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      }

      // Leave
      if (leaveRes.status === 'fulfilled') {
        const res = leaveRes.value;
        setPendingLeaves(Array.isArray(res?.data) ? res.data : []);
      }

      // Reviews
      if (reviewRes.status === 'fulfilled') {
        const res = reviewRes.value;
        setActiveReviews(Array.isArray(res?.data) ? res.data : []);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = [
    {
      title: 'Total Staff',
      value: totalStaff.toString(),
      sub: `${activeStaff} active`,
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Departments',
      value: departments.length.toString(),
      sub: `${departments.reduce((s, d) => s + (d._count?.staff || 0), 0)} staff assigned`,
      icon: Building,
      color: 'text-cyan-600',
      bg: 'bg-cyan-100',
    },
    {
      title: 'Pending Leave',
      value: pendingLeaves.length.toString(),
      sub: pendingLeaves.length > 0 ? 'Awaiting approval' : 'All clear',
      icon: CalendarDays,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      title: 'Active Reviews',
      value: activeReviews.length.toString(),
      sub: activeReviews.length > 0 ? 'In progress' : 'None in progress',
      icon: Star,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
  ];

  const hrModules = [
    {
      title: 'Attendance',
      description: 'Track staff attendance, clock-in/out records, and overtime',
      href: '/dashboard/admin/hr/attendance',
      icon: Clock,
      color: 'bg-green-500',
    },
    {
      title: 'Leave Management',
      description: 'Manage leave requests, approvals, and balance tracking',
      href: '/dashboard/admin/hr/leave',
      icon: CalendarDays,
      color: 'bg-yellow-500',
    },
    {
      title: 'Performance Reviews',
      description: 'Conduct reviews, set goals, and track performance metrics',
      href: '/dashboard/admin/hr/performance',
      icon: Star,
      color: 'bg-purple-500',
    },
    {
      title: 'Staff Payroll',
      description: 'Process payroll, manage deductions, and generate payslips',
      href: '/dashboard/admin/hr/payroll',
      icon: Wallet,
      color: 'bg-blue-500',
    },
    {
      title: 'Realtor Commission Payroll',
      description: 'Manage and process realtor commission payments by period',
      href: '/dashboard/admin/hr/realtor-payroll',
      icon: Wallet,
      color: 'bg-emerald-500',
    },
    {
      title: 'Policies & Penalties',
      description: 'Configure lateness, absence, and task penalty rules',
      href: '/dashboard/admin/hr/policies',
      icon: Shield,
      color: 'bg-red-500',
    },
    {
      title: 'Salary Configuration',
      description: 'Manage salary structures, allowances, and deductions',
      href: '/dashboard/admin/hr/salary-config',
      icon: Settings2,
      color: 'bg-indigo-500',
    },
    {
      title: 'Task Management',
      description: 'Create, assign, and track staff tasks and deadlines',
      href: '/dashboard/admin/hr/tasks',
      icon: CheckSquare,
      color: 'bg-teal-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">HR Dashboard</h1>
          <p className="text-muted-foreground">Overview of all HR activities and management</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pending Leave Requests */}
      {pendingLeaves.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                  Pending Leave Requests
                </CardTitle>
                <Link href="/dashboard/admin/hr/leave">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View all <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-5 h-5 text-yellow-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {leave.staffProfile?.user?.firstName} {leave.staffProfile?.user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leave.type.replace('_', ' ')} &middot; {leave.startDate?.split('T')[0]} to {leave.endDate?.split('T')[0]}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Pending</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* HR Modules */}
      <div className="grid gap-4 md:grid-cols-2">
        {hrModules.map((mod, index) => (
          <motion.div
            key={mod.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <Link href={mod.href}>
              <Card className="hover:shadow-lg transition-all hover:border-primary/30 cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${mod.color} flex items-center justify-center`}>
                        <mod.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{mod.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recently Added Staff */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Recent Staff Members
              </CardTitle>
              <Link href="/dashboard/admin/staff">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No staff members yet</p>
            ) : (
              <div className="space-y-3">
                {recentStaff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-primary text-white text-sm">
                          {member.user.firstName[0]}{member.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.user.firstName} {member.user.lastName}</p>
                        <p className="text-xs text-muted-foreground">{member.title} &middot; {member.department?.name || 'No dept'}</p>
                      </div>
                    </div>
                    <Badge className={member.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Department Overview */}
      {departments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Departments
                </CardTitle>
                <Link href="/dashboard/admin/departments">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Manage <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept) => (
                  <Link key={dept.id} href={`/dashboard/admin/staff?department=${dept.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">{dept._count?.staff || 0} staff</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
