'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Clock,
  CalendarDays,
  CalendarCheck,
  Star,
  Wallet,
  Users,
  UserPlus,
  ArrowRight,
  Loader2,
  RefreshCw,
  Building,
  Shield,
  CheckSquare,
  Settings2,
  ClipboardCheck,
  AlertCircle,
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

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

      if (staffRes.status === 'fulfilled') {
        const res = staffRes.value;
        const list = Array.isArray(res?.data) ? res.data : [];
        setRecentStaff(list);
        setTotalStaff(res?.meta?.total ?? list.length);
        setActiveStaff(list.filter((s: StaffMember) => s.isActive).length);
      }

      if (deptRes.status === 'fulfilled') {
        const res = deptRes.value;
        setDepartments(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      }

      if (leaveRes.status === 'fulfilled') {
        const res = leaveRes.value;
        setPendingLeaves(Array.isArray(res?.data) ? res.data : []);
      }

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

  const deptStaffTotal = departments.reduce((s, d) => s + (d._count?.staff || 0), 0);

  const statCards = [
    {
      label: 'Total Staff',
      value: totalStaff,
      sub: `${activeStaff} active`,
      icon: Users,
      gradient: 'from-green-500 to-green-700',
      iconBg: 'bg-green-400/30',
    },
    {
      label: 'Active Staff',
      value: activeStaff,
      sub: 'Currently employed',
      icon: UserPlus,
      gradient: 'from-emerald-500 to-emerald-700',
      iconBg: 'bg-emerald-400/30',
    },
    {
      label: 'On Leave',
      value: pendingLeaves.length,
      sub: pendingLeaves.length > 0 ? 'Awaiting approval' : 'All clear',
      icon: CalendarDays,
      gradient: 'from-yellow-500 to-amber-600',
      iconBg: 'bg-yellow-400/30',
    },
    {
      label: 'Departments',
      value: departments.length,
      sub: `${deptStaffTotal} staff assigned`,
      icon: Building,
      gradient: 'from-blue-500 to-blue-700',
      iconBg: 'bg-blue-400/30',
    },
    {
      label: 'Pending Reviews',
      value: activeReviews.length,
      sub: activeReviews.length > 0 ? 'In progress' : 'None in progress',
      icon: Star,
      gradient: 'from-purple-500 to-purple-700',
      iconBg: 'bg-purple-400/30',
    },
    {
      label: 'Dept. Staff',
      value: deptStaffTotal,
      sub: 'Across all departments',
      icon: ClipboardCheck,
      gradient: 'from-cyan-500 to-cyan-700',
      iconBg: 'bg-cyan-400/30',
    },
  ];

  const quickActions = [
    {
      label: 'Add Staff',
      description: 'Onboard a new team member',
      href: '/dashboard/admin/staff',
      icon: UserPlus,
      color: 'text-green-600',
      iconBg: 'bg-green-100',
      border: 'hover:border-green-300',
    },
    {
      label: 'Approve Leave',
      description: 'Review pending requests',
      href: '/dashboard/admin/hr/leave',
      icon: CalendarCheck,
      color: 'text-yellow-600',
      iconBg: 'bg-yellow-100',
      border: 'hover:border-yellow-300',
    },
    {
      label: 'Run Payroll',
      description: 'Process staff payments',
      href: '/dashboard/admin/hr/payroll',
      icon: Wallet,
      color: 'text-blue-600',
      iconBg: 'bg-blue-100',
      border: 'hover:border-blue-300',
    },
    {
      label: 'Mark Attendance',
      description: 'Log daily attendance',
      href: '/dashboard/admin/hr/attendance',
      icon: ClipboardCheck,
      color: 'text-teal-600',
      iconBg: 'bg-teal-100',
      border: 'hover:border-teal-300',
    },
    {
      label: 'New Review',
      description: 'Start a performance cycle',
      href: '/dashboard/admin/hr/performance',
      icon: Star,
      color: 'text-purple-600',
      iconBg: 'bg-purple-100',
      border: 'hover:border-purple-300',
    },
  ];

  const hrModules = [
    {
      title: 'Attendance',
      description: 'Track attendance & overtime',
      href: '/dashboard/admin/hr/attendance',
      icon: Clock,
      color: 'bg-green-500',
      ring: 'hover:ring-green-200',
    },
    {
      title: 'Leave Management',
      description: 'Leave requests & approvals',
      href: '/dashboard/admin/hr/leave',
      icon: CalendarDays,
      color: 'bg-yellow-500',
      ring: 'hover:ring-yellow-200',
    },
    {
      title: 'Performance Reviews',
      description: 'Reviews, goals & metrics',
      href: '/dashboard/admin/hr/performance',
      icon: Star,
      color: 'bg-purple-500',
      ring: 'hover:ring-purple-200',
    },
    {
      title: 'Staff Payroll',
      description: 'Payroll & payslips',
      href: '/dashboard/admin/hr/payroll',
      icon: Wallet,
      color: 'bg-blue-500',
      ring: 'hover:ring-blue-200',
    },
    {
      title: 'Realtor Commission Payroll',
      description: 'Commission payments',
      href: '/dashboard/admin/hr/realtor-payroll',
      icon: Wallet,
      color: 'bg-emerald-500',
      ring: 'hover:ring-emerald-200',
    },
    {
      title: 'Policies & Penalties',
      description: 'Penalty rules',
      href: '/dashboard/admin/hr/policies',
      icon: Shield,
      color: 'bg-red-500',
      ring: 'hover:ring-red-200',
    },
    {
      title: 'Salary Configuration',
      description: 'Salary structures',
      href: '/dashboard/admin/hr/salary-config',
      icon: Settings2,
      color: 'bg-indigo-500',
      ring: 'hover:ring-indigo-200',
    },
    {
      title: 'Task Management',
      description: 'Staff tasks',
      href: '/dashboard/admin/hr/tasks',
      icon: CheckSquare,
      color: 'bg-teal-500',
      ring: 'hover:ring-teal-200',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading HR Control Center...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-10"
    >
      {/* ── 1. HEADER ── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Control Center</h1>
          <p className="text-muted-foreground mt-1">Manage people, performance, and operations</p>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </motion.div>

      {/* ── 2. LIVE STATS ROW ── */}
      <motion.div variants={itemVariants} className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.35, ease: 'easeOut' }}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} text-white p-5 shadow-md flex flex-col gap-3`}
          >
            <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold leading-none">{card.value}</p>
              <p className="text-sm font-medium mt-1 opacity-90">{card.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{card.sub}</p>
            </div>
            {/* decorative circle */}
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
          </motion.div>
        ))}
      </motion.div>

      {/* ── 3. QUICK ACTIONS BAR ── */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <div
                className={`flex flex-col gap-3 p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 hover:shadow-md ${action.border} hover:-translate-y-0.5`}
              >
                <div className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── 4. MODULE GRID ── */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">HR Modules</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {hrModules.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.35, ease: 'easeOut' }}
            >
              <Link href={mod.href}>
                <div
                  className={`group flex flex-col gap-4 p-5 rounded-xl border bg-card cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ring-2 ring-transparent ${mod.ring}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl ${mod.color} flex items-center justify-center shadow-sm`}>
                      <mod.icon className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{mod.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── 5. ACTIVITY FEED ── */}
      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
        {/* Left: Pending Leave Requests */}
        <Card className="border-yellow-200 dark:border-yellow-800/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-yellow-600 text-base">
                <AlertCircle className="w-5 h-5" />
                Pending Leave Requests
              </CardTitle>
              <Link href="/dashboard/admin/hr/leave">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <CalendarCheck className="w-8 h-8 opacity-30" />
                <p className="text-sm">No pending leave requests</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4 h-4 text-yellow-700 dark:text-yellow-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {leave.staffProfile?.user?.firstName} {leave.staffProfile?.user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {leave.type.replace(/_/g, ' ')} &middot;{' '}
                          {leave.startDate?.split('T')[0]} to {leave.endDate?.split('T')[0]}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-700 shrink-0 border-yellow-200">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Staff */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-primary" />
                Recent Staff
              </CardTitle>
              <Link href="/dashboard/admin/staff">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Users className="w-8 h-8 opacity-30" />
                <p className="text-sm">No staff members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentStaff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                          {member.user.firstName[0]}{member.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.title} &middot; {member.department?.name || 'No dept'}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        member.isActive
                          ? 'bg-green-100 text-green-700 border-green-200 shrink-0'
                          : 'bg-red-100 text-red-700 border-red-200 shrink-0'
                      }
                    >
                      {member.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
