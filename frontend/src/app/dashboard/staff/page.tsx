'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AwardBanner } from '@/components/award-banner';
import {
  CheckSquare,
  Clock,
  CalendarDays,
  TrendingUp,
  Users,
  MessageSquare,
  CheckCircle2,
  Eye,
  FileText,
  Plus,
  Search,
  Play,
  Award,
  Target,
  Loader2,
  Pause,
  Crown,
  Copy,
  Check,
  Users2,
  Link,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUser } from '@/lib/auth-storage';

type Period = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const miniChartData = [
  { v: 3 }, { v: 5 }, { v: 4 }, { v: 7 }, { v: 5 }, { v: 8 }, { v: 6 },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'IN_PROGRESS':
      return <Badge className="bg-[#2b1464]/10 text-[#2b1464] hover:bg-[#2b1464]/20">In Progress</Badge>;
    case 'TODO':
      return <Badge className="bg-[#fca639]/10 text-[#fca639] hover:bg-[#fca639]/20">To Do</Badge>;
    case 'IN_REVIEW':
      return <Badge className="bg-purple-100 text-purple-600 hover:bg-purple-200">In Review</Badge>;
    case 'COMPLETED':
      return <Badge className="bg-green-100 text-green-600 hover:bg-green-200">Completed</Badge>;
    case 'BLOCKED':
      return <Badge className="bg-red-100 text-red-600 hover:bg-red-200">Blocked</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Urgent" />;
    case 'HIGH':
      return <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" title="High" />;
    case 'MEDIUM':
      return <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" title="Medium" />;
    default:
      return <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" title="Low" />;
  }
};

export default function StaffDashboard() {
  const [period, setPeriod] = useState<Period>('WEEKLY');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [staffOfMonth, setStaffOfMonth] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff');
      if (user.referralCode) setReferralCode(user.referralCode);
    }
  }, []);

  const handleCopyReferral = () => {
    const link = `${window.location.origin}/auth/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const fetchStaffOfMonth = async () => {
      try {
        const res: any = await api.get('/awards/staff-of-month');
        const award = res?.data !== undefined ? res.data : res;
        setStaffOfMonth(award && award.user ? award : null);
      } catch {
        setStaffOfMonth(null);
      }
    };

    fetchStaffOfMonth();
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res: any = await api.get('/staff/dashboard');
        const data = res.data || res;
        setDashboardData(data);

        // Check if user is clocked in today
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = data.recentAttendance?.find(
          (a: any) => a.date?.startsWith(today) && a.clockIn && !a.clockOut
        );
        setIsClockedIn(!!todayAttendance);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchTasks = async () => {
      try {
        const res: any = await api.get('/tasks/my');
        const allTasks = res?.data || res;
        // Filter to active tasks and limit to 5 for the dashboard
        const activeTasks = (Array.isArray(allTasks) ? allTasks : [])
          .filter((t: any) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status))
          .slice(0, 5);
        setTasks(activeTasks);
      } catch {
        setTasks([]);
      }
    };

    fetchDashboard();
    fetchTasks();
  }, []);

  const handleClockToggle = async () => {
    try {
      if (isClockedIn) {
        await api.post('/hr/attendance/clock-out');
        toast.success('Clocked out successfully!');
      } else {
        await api.post('/hr/attendance/clock-in');
        toast.success('Clocked in successfully!');
      }
      setIsClockedIn(!isClockedIn);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update attendance');
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: 'IN_PROGRESS' });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'IN_PROGRESS' } : t));
      toast.success('Task started!');
    } catch {
      toast.error('Failed to start task');
    }
  };

  const handleSubmitForReview = async (taskId: string) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: 'IN_REVIEW' });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'IN_REVIEW' } : t));
      toast.success('Task submitted for review!');
    } catch {
      toast.error('Failed to submit task for review');
    }
  };

  // Derive stats from API data
  const profile = dashboardData?.profile || {};
  const stats = dashboardData?.stats || {};
  const upcomingReviews = dashboardData?.upcomingReviews || [];
  const recentAttendance = dashboardData?.recentAttendance || [];

  const pendingTasks = stats.pendingTasks || 0;
  const completedThisMonth = stats.completedTasksThisMonth || 0;
  const annualLeave = stats.annualLeaveBalance ?? profile.annualLeaveBalance ?? 0;
  const sickLeave = stats.sickLeaveBalance ?? profile.sickLeaveBalance ?? 0;
  const totalLeave = annualLeave + sickLeave;
  const teamMembers = stats.teamMembers || 0;

  // Task distribution for pie chart
  const taskDistribution = useMemo(() => [
    { name: 'Completed', value: completedThisMonth || 1, color: '#2b1464' },
    { name: 'Pending', value: pendingTasks || 1, color: '#fca639' },
    { name: 'Blocked', value: 0, color: '#ef4444' },
  ].filter(t => t.value > 0), [completedThisMonth, pendingTasks]);
  const totalTaskDist = useMemo(() => taskDistribution.reduce((s, t) => s + t.value, 0) || 1, [taskDistribution]);

  // Build weekly attendance chart data
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const attendanceChartData = useMemo(() => weekDays.map((day, idx) => {
    const record = recentAttendance.find((a: any) => new Date(a.date).getDay() === idx);
    return {
      day,
      hours: record?.hoursWorked || 0,
      present: record?.status === 'PRESENT' || record?.status === 'WORK_FROM_HOME' ? 1 : 0,
    };
  }), [recentAttendance]);

  // Bottom stats
  const bottomStats = [
    { label: 'Tasks Completed', value: String(completedThisMonth), icon: CheckCircle2, color: '#2b1464' },
    { label: 'Pending Tasks', value: String(pendingTasks), icon: CheckSquare, color: '#fca639' },
    { label: 'Leave Balance', value: `${totalLeave} days`, icon: CalendarDays, color: '#2b1464' },
    { label: 'Team Members', value: String(teamMembers), icon: Users, color: '#fca639' },
  ];

  // Gradient cards
  const gradientCards = [
    { title: 'Pending Tasks', value: String(pendingTasks), subtitle: 'Assigned to you', gradient: 'from-[#2b1464] to-[#3b2190]', icon: CheckSquare },
    { title: 'Annual Leave', value: String(annualLeave), subtitle: 'Days remaining', gradient: 'from-[#fca639] to-[#fdb95c]', icon: CalendarDays },
    { title: 'Sick Leave', value: String(sickLeave), subtitle: 'Days remaining', gradient: 'from-[#2b1464] to-[#14956e]', icon: CalendarDays },
    { title: 'Reviews', value: String(upcomingReviews.length), subtitle: 'Upcoming', gradient: 'from-[#fca639] to-[#e8953a]', icon: Target },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AwardBanner />

      {/* Staff of the Month Spotlight */}
      {staffOfMonth && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-yellow-300" />
                <span className="text-sm font-semibold opacity-90">Staff of the Month</span>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-4 border-white/30">
                  {staffOfMonth.user?.avatar && (
                    <AvatarImage src={getImageUrl(staffOfMonth.user.avatar)} alt={staffOfMonth.user?.firstName} />
                  )}
                  <AvatarFallback className="bg-white/20 text-white text-xl">
                    {(staffOfMonth.user?.firstName?.[0] || '') + (staffOfMonth.user?.lastName?.[0] || '')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">
                    {staffOfMonth.user?.firstName} {staffOfMonth.user?.lastName}
                  </h3>
                  <p className="text-sm text-white/80">
                    {new Date(0, staffOfMonth.month - 1).toLocaleString('en', { month: 'long' })} {staffOfMonth.year}
                  </p>
                </div>
              </div>
              {staffOfMonth.reason && (
                <p className="mt-4 text-sm text-white/80 bg-white/10 rounded-lg p-3">{staffOfMonth.reason}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Row 1: Main Chart + Task Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Good morning, {userName}!</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {profile.title || 'Staff'} &bull; {profile.department?.name || 'Department'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleClockToggle}
                    className={isClockedIn
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-[#2b1464] hover:bg-[#1e0e47] text-white'
                    }
                  >
                    {isClockedIn ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isClockedIn ? 'Clock Out' : 'Clock In'}
                  </Button>
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as Period[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          period === p
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-[200px_1fr] gap-6">
                <div className="space-y-6">
                  <div>
                    <p className="text-3xl font-bold">{pendingTasks + completedThisMonth}</p>
                    <p className="text-sm text-muted-foreground">Total Tasks</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{completedThisMonth}</p>
                    <p className="text-sm text-muted-foreground">Completed This Month</p>
                  </div>
                  <Button className="bg-[#2b1464] hover:bg-[#1e0e47] text-white rounded-full px-6" asChild>
                    <a href="/dashboard/staff/tasks">View All Tasks</a>
                  </Button>
                </div>

                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendanceChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2b1464" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2b1464" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="hours" stroke="#2b1464" strokeWidth={2.5} fill="url(#colorHours)" name="Hours Worked" dot={{ r: 4, fill: '#2b1464', stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                {bottomStats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                      <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="font-semibold">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Task Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-lg">Task Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {taskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4 w-full">
                {taskDistribution.map((item) => {
                  const pct = ((item.value / totalTaskDist) * 100).toFixed(0);
                  return (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <span className="text-xl font-bold">{pct}</span>
                        <span className="text-xs text-muted-foreground">%</span>
                        <p className="text-xs text-muted-foreground">{item.name} ({item.value})</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Row 2: Gradient Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {gradientCards.map((card, index) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.05 }}>
            <Card className={`bg-gradient-to-br ${card.gradient} text-white overflow-hidden shadow-sm border-0`}>
              <CardContent className="p-5 relative">
                <div className="absolute top-3 right-3 opacity-20">
                  <card.icon className="w-12 h-12" />
                </div>
                <p className="text-sm font-medium opacity-90">{card.title}</p>
                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs opacity-75 mt-1">{card.subtitle}</p>
                  </div>
                  <div className="w-[80px] h-[40px] opacity-50">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={miniChartData}>
                        <Bar dataKey="v" fill="rgba(255,255,255,0.6)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Referral Link Card */}
      {referralCode && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyReferral} className="gap-1.5">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" className="bg-[#2b1464] hover:bg-[#1e0e47] text-white gap-1.5" asChild>
                    <a href="/dashboard/staff/referrals">
                      <Users2 className="w-4 h-4" />
                      View Leads
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Row 3: Tasks Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">My Tasks</CardTitle>
                <p className="text-sm text-muted-foreground">Overview of assigned tasks</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="bg-[#2b1464] hover:bg-[#1e0e47] text-white gap-1" asChild>
                  <a href="/dashboard/staff/tasks">
                    <Plus className="w-4 h-4" />
                    View All
                  </a>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#2b1464] hover:bg-[#2b1464]">
                    <TableHead className="text-white font-semibold">TITLE</TableHead>
                    <TableHead className="text-white font-semibold">PRIORITY</TableHead>
                    <TableHead className="text-white font-semibold">DUE DATE</TableHead>
                    <TableHead className="text-white font-semibold">STATUS</TableHead>
                    <TableHead className="text-white font-semibold">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(task.priority)}
                          <span className="text-xs text-muted-foreground">{task.priority}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {task.status === 'TODO' && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[#2b1464] hover:bg-[#2b1464]/10" onClick={() => handleStartTask(task.id)}>
                              <Play className="w-3 h-3" />
                            </Button>
                          )}
                          {task.status === 'IN_PROGRESS' && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[#2b1464] hover:bg-[#2b1464]/10" onClick={() => handleSubmitForReview(task.id)} title="Submit for Review">
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No tasks assigned yet
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Row 4: Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
                <a href="/dashboard/staff/leave">
                  <CalendarDays className="w-6 h-6 text-[#2b1464]" />
                  <span>Request Leave</span>
                </a>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
                <a href="/dashboard/staff/payslips">
                  <FileText className="w-6 h-6 text-[#fca639]" />
                  <span>View Payslip</span>
                </a>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
                <a href="/dashboard/staff/team">
                  <Users className="w-6 h-6 text-[#2b1464]" />
                  <span>Team Directory</span>
                </a>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
                <a href="/dashboard/staff/reviews">
                  <Award className="w-6 h-6 text-[#fca639]" />
                  <span>View Performance</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
