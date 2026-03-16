'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Timer,
  TrendingUp,
  CheckCircle2,
  MapPin,
  Loader2,
  RefreshCw,
  QrCode,
  CameraOff,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: number | null;
  overtime: number | null;
  status: string;
  notes: string | null;
  location: string | null;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PRESENT':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Present</Badge>;
    case 'LATE':
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Late</Badge>;
    case 'ABSENT':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Absent</Badge>;
    case 'ON_LEAVE':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">On Leave</Badge>;
    case 'WORK_FROM_HOME':
      return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">WFH</Badge>;
    case 'HALF_DAY':
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Half Day</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getDayName = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const formatDuration = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return `${hours}h ${minutes}m`;
};

// ── QR Scanner Modal ──────────────────────────────────────────────────────────

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (token: string) => void;
}

function QrScannerModal({ open, onClose, onScanned }: QrScannerProps) {
  const scannerRef = useRef<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const divId = 'qr-attendance-scanner';

  useEffect(() => {
    if (!open) return;

    setCameraError(null);
    setStarting(true);

    let scanner: any;
    let stopped = false;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;

        scanner = new Html5Qrcode(divId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text: string) => {
            // Success — stop scanner then notify parent
            scanner.stop().catch(() => {});
            onScanned(text);
          },
          // Frame errors are expected — ignore them
          undefined,
        );
        setStarting(false);
      } catch (err: any) {
        if (!stopped) {
          setCameraError(
            err?.message?.includes('permission')
              ? 'Camera permission denied. Please allow camera access and try again.'
              : 'Could not start camera. Make sure no other app is using it.',
          );
          setStarting(false);
        }
      }
    };

    start();

    return () => {
      stopped = true;
      scannerRef.current?.stop()?.catch(() => {});
      scannerRef.current = null;
    };
  }, [open, onScanned]);

  const handleClose = () => {
    scannerRef.current?.stop()?.catch(() => {});
    scannerRef.current = null;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Scan Attendance QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 p-2">
          <p className="text-sm text-center text-muted-foreground">
            Point your camera at the QR code displayed by your admin to clock in.
          </p>

          {cameraError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CameraOff className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-destructive">{cameraError}</p>
            </div>
          ) : (
            <div className="relative w-full">
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              {/* html5-qrcode mounts its video + canvas into this div */}
              <div
                id={divId}
                className="w-full overflow-hidden rounded-lg"
                style={{ minHeight: '280px' }}
              />
            </div>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={handleClose}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const isClockedIn = todayRecord?.clockIn && !todayRecord?.clockOut;

  // Calculate weekly stats from history
  const weeklyStats = useCallback(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekRecords = attendanceHistory.filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate >= weekStart && recordDate <= now;
    });

    const totalHours = weekRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
    const totalOvertime = weekRecords.reduce((sum, r) => sum + (r.overtime || 0), 0);
    const onTimeDays = weekRecords.filter((r) => r.status === 'PRESENT').length;
    const totalDays = weekRecords.filter((r) => r.clockIn).length;

    const clockInTimes = weekRecords
      .filter((r) => r.clockIn)
      .map((r) => {
        const date = new Date(r.clockIn!);
        return date.getHours() * 60 + date.getMinutes();
      });
    const avgClockInMinutes = clockInTimes.length > 0
      ? Math.round(clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length)
      : 0;
    const avgHours = Math.floor(avgClockInMinutes / 60);
    const avgMins = avgClockInMinutes % 60;
    const avgClockIn = clockInTimes.length > 0
      ? `${avgHours > 12 ? avgHours - 12 : avgHours}:${avgMins.toString().padStart(2, '0')} ${avgHours >= 12 ? 'PM' : 'AM'}`
      : '-';

    return [
      { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
      { label: 'On Time Days', value: `${onTimeDays}/${totalDays}`, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
      { label: 'Overtime', value: `${totalOvertime.toFixed(1)}h`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100' },
      { label: 'Avg. Clock In', value: avgClockIn, icon: LogIn, color: 'text-primary', bg: 'bg-primary/10' },
    ];
  }, [attendanceHistory]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, todayRes] = await Promise.all([
        api.get('/hr/attendance/my'),
        api.get('/hr/attendance/today'),
      ]);

      const historyData = Array.isArray(historyRes) ? historyRes : (historyRes?.data || []);
      setAttendanceHistory(historyData);

      const todayData = todayRes?.data || todayRes;
      setTodayRecord(todayData?.record || null);

      if (todayData?.record?.clockIn && !todayData?.record?.clockOut) {
        const clockInTime = new Date(todayData.record.clockIn).getTime();
        setElapsedTime(Math.floor((Date.now() - clockInTime) / 1000));
      } else {
        setElapsedTime(0);
      }
    } catch (err: any) {
      console.error('Failed to fetch attendance:', err);
      toast.error(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Live timer
  useEffect(() => {
    if (isClockedIn && todayRecord?.clockIn) {
      timerRef.current = setInterval(() => {
        const clockInTime = new Date(todayRecord.clockIn!).getTime();
        setElapsedTime(Math.floor((Date.now() - clockInTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isClockedIn, todayRecord?.clockIn]);

  // Called after a successful QR scan
  const handleQrScanned = useCallback(async (qrToken: string) => {
    setShowScanner(false);
    setActionLoading(true);
    try {
      await api.post('/hr/attendance/clock-in', { qrToken });
      toast.success('Clocked in successfully!');
      fetchAttendance();
    } catch (err: any) {
      const msg = err.message || 'Failed to clock in';
      if (msg.toLowerCase().includes('already clocked in') || msg.toLowerCase().includes('clock out first')) {
        toast.info('You are already clocked in. Refreshing status…');
        fetchAttendance();
      } else {
        toast.error(msg);
      }
    } finally {
      setActionLoading(false);
    }
  }, [fetchAttendance]);

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await api.post('/hr/attendance/clock-out', {});
      toast.success('Clocked out successfully!');
      fetchAttendance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clock out');
    } finally {
      setActionLoading(false);
    }
  };

  const currentDuration = formatDuration(elapsedTime / 60);
  const stats = weeklyStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Scanner Modal */}
      <QrScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleQrScanned}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Track your work hours and attendance</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchAttendance} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Clock In/Out Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isClockedIn
                      ? 'Currently Working'
                      : todayRecord?.clockOut
                        ? 'On Break / Clocked Out'
                        : 'Not Clocked In'}
                  </p>
                  <p className="text-4xl font-bold font-mono">
                    {isClockedIn ? currentDuration : '0h 0m'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                    {todayRecord?.clockIn && (
                      <span className="flex items-center gap-1">
                        <LogIn className="w-4 h-4" />
                        {isClockedIn ? 'Session started:' : 'Last clock in:'} {formatTime(todayRecord.clockIn)}
                      </span>
                    )}
                    {todayRecord?.clockOut && (
                      <span className="flex items-center gap-1">
                        <LogOut className="w-4 h-4" />
                        Last clock out: {formatTime(todayRecord.clockOut)}
                      </span>
                    )}
                    {todayRecord?.hoursWorked != null && todayRecord.hoursWorked > 0 && (
                      <span className="flex items-center gap-1">
                        <Timer className="w-4 h-4" />
                        Total today: {todayRecord.hoursWorked.toFixed(1)}h
                      </span>
                    )}
                    {todayRecord?.overtime != null && todayRecord.overtime > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        Overtime: +{todayRecord.overtime.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {isClockedIn ? (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="gap-2 min-w-[150px]"
                    onClick={handleClockOut}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="w-5 h-5" />
                        Clock Out
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="gap-2 min-w-[150px]"
                    onClick={() => setShowScanner(true)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <QrCode className="w-5 h-5" />
                        Clock In
                      </>
                    )}
                  </Button>
                )}

                {todayRecord?.clockOut && !isClockedIn && (
                  <p className="text-xs text-muted-foreground text-center">
                    Last session: {todayRecord.hoursWorked?.toFixed(1) || 0}h worked
                  </p>
                )}
                {todayRecord?.location && (
                  <Button variant="outline" size="sm" className="gap-2">
                    <MapPin className="w-4 h-4" />
                    {todayRecord.location}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Weekly Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Attendance History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Attendance History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records yet</p>
                <p className="text-sm">Scan the attendance QR code to start tracking</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{formatDate(record.date)}</TableCell>
                        <TableCell>{getDayName(record.date)}</TableCell>
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
