'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Search,
  Calendar,
  Loader2,
  RefreshCw,
  QrCode,
  RotateCw,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';

interface QrData {
  token: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: number | null;
  overtime: number | null;
  status: string;
  staffProfile: {
    id: string;
    user: { firstName: string; lastName: string; avatar: string | null };
    department: { name: string } | null;
  };
}

interface Department {
  id: string;
  name: string;
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { className: string; label: string }> = {
    PRESENT: { className: 'bg-green-100 text-green-700', label: 'Present' },
    LATE: { className: 'bg-orange-100 text-orange-700', label: 'Late' },
    ABSENT: { className: 'bg-red-100 text-red-700', label: 'Absent' },
    ON_LEAVE: { className: 'bg-blue-100 text-blue-700', label: 'On Leave' },
    WORK_FROM_HOME: { className: 'bg-purple-100 text-purple-700', label: 'WFH' },
    HALF_DAY: { className: 'bg-yellow-100 text-yellow-700', label: 'Half Day' },
  };
  const c = config[status] || { className: '', label: status };
  return <Badge className={c.className}>{c.label}</Badge>;
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function AdminAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // QR code state
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const generateQrCode = async () => {
    setQrLoading(true);
    try {
      const res = await api.get<any>('/hr/attendance/qr/today');
      const data = res?.data || res;
      setQrData(data);
      setShowQrDialog(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', selectedDate);
      params.append('endDate', selectedDate);
      if (departmentFilter !== 'all') params.append('departmentId', departmentFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const [attendanceRes, deptRes] = await Promise.allSettled([
        api.get<any>(`/hr/attendance?${params.toString()}`),
        api.get<any>('/departments'),
      ]);

      if (attendanceRes.status === 'fulfilled') {
        const data = attendanceRes.value?.data?.data || attendanceRes.value?.data || [];
        setAttendance(Array.isArray(data) ? data : []);
      }

      if (deptRes.status === 'fulfilled') {
        const data = deptRes.value?.data || deptRes.value || [];
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch attendance:', err);
      toast.error(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, departmentFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats from attendance data
  const stats = [
    { label: 'Present',   value: attendance.filter((a) => a.status === 'PRESENT').length,          color: 'bg-green-500' },
    { label: 'Late',      value: attendance.filter((a) => a.status === 'LATE').length,              color: 'bg-orange-500' },
    { label: 'Half Day',  value: attendance.filter((a) => a.status === 'HALF_DAY').length,          color: 'bg-yellow-500' },
    { label: 'Absent',    value: attendance.filter((a) => a.status === 'ABSENT').length,            color: 'bg-red-500' },
    { label: 'On Leave',  value: attendance.filter((a) => a.status === 'ON_LEAVE').length,          color: 'bg-blue-500' },
    { label: 'WFH',       value: attendance.filter((a) => a.status === 'WORK_FROM_HOME').length,    color: 'bg-purple-500' },
  ];

  const total = attendance.length || 1;

  // Filter by search
  const filteredAttendance = attendance.filter((record) => {
    if (!searchQuery) return true;
    const name = `${record.staffProfile?.user?.firstName || ''} ${record.staffProfile?.user?.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (loading && attendance.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">Monitor and manage staff attendance records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-[180px]"
          />
          <Button className="gap-2" onClick={generateQrCode} disabled={qrLoading}>
            {qrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            Show QR Code
          </Button>
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-6 mb-4">
              <h3 className="font-semibold">Today's Overview</h3>
              <span className="text-sm text-muted-foreground">{attendance.length} total records</span>
            </div>
            {attendance.length > 0 ? (
              <>
                <div className="flex gap-2 h-4 rounded-full overflow-hidden mb-4">
                  {stats.filter((s) => s.value > 0).map((s) => (
                    <div
                      key={s.label}
                      className={`${s.color} transition-all`}
                      style={{ width: `${(s.value / total) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  {stats.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${s.color}`} />
                      <span className="text-sm">{s.label}: <strong>{s.value}</strong></span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No attendance records for this date</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PRESENT">Present</SelectItem>
            <SelectItem value="LATE">Late</SelectItem>
            <SelectItem value="HALF_DAY">Half Day</SelectItem>
            <SelectItem value="ABSENT">Absent</SelectItem>
            <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            <SelectItem value="WORK_FROM_HOME">Work from Home</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Today's Attendance QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 p-2">
            <p className="text-sm text-center text-muted-foreground">
              Display this to staff — they scan it with their phone to clock in.
            </p>
            {qrData?.qrCodeDataUrl && (
              <div className="border-4 border-black rounded-xl p-2 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.qrCodeDataUrl}
                  alt="Attendance QR Code"
                  className="w-64 h-64"
                />
              </div>
            )}
            {qrData?.expiresAt && (
              <p className="text-xs text-muted-foreground">
                Valid until {new Date(qrData.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={generateQrCode}
              disabled={qrLoading}
            >
              {qrLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCw className="w-4 h-4" />
              )}
              Regenerate QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-0">
            {filteredAttendance.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              {record.staffProfile?.user?.avatar && (
                                <AvatarImage src={getImageUrl(record.staffProfile.user.avatar)} />
                              )}
                              <AvatarFallback className="bg-primary text-white text-xs">
                                {record.staffProfile?.user?.firstName?.[0] || ''}
                                {record.staffProfile?.user?.lastName?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {record.staffProfile?.user?.firstName} {record.staffProfile?.user?.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{record.staffProfile?.department?.name || '-'}</TableCell>
                        <TableCell>{formatTime(record.clockIn)}</TableCell>
                        <TableCell>{formatTime(record.clockOut)}</TableCell>
                        <TableCell>{record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : '-'}</TableCell>
                        <TableCell>
                          {record.overtime && record.overtime > 0 ? (
                            <span className="text-green-600">+{record.overtime.toFixed(1)}h</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
