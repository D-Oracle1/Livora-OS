import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../../database/prisma.service';
import { ClockInDto, ClockOutDto, UpdateAttendanceDto, AttendanceQueryDto } from '../dto/attendance.dto';
import { AttendanceStatus } from '@prisma/client';
import { PolicyService } from './policy.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly jwtService: JwtService,
  ) {}

  // ── QR CODE ──────────────────────────────────────────────────────────────

  async generateTodayQr(): Promise<{ token: string; qrCodeDataUrl: string; expiresAt: string }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Token expires at end of day
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const ttl = Math.floor((endOfDay.getTime() - Date.now()) / 1000);

    const token = this.jwtService.sign(
      { type: 'attendance-qr', date: today },
      { expiresIn: ttl },
    );

    const qrCodeDataUrl = await QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return { token, qrCodeDataUrl, expiresAt: endOfDay.toISOString() };
  }

  private validateQrToken(qrToken: string): void {
    try {
      const payload = this.jwtService.verify(qrToken) as { type: string; date: string };

      if (payload.type !== 'attendance-qr') {
        throw new BadRequestException('Invalid QR code');
      }

      const today = new Date().toISOString().split('T')[0];
      if (payload.date !== today) {
        throw new BadRequestException("QR code has expired — ask your admin to generate today's code");
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid or expired QR code');
    }
  }

  private async getAttendanceThresholds() {
    const [workStartSetting, workHoursSetting, latenessPolicy] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'work_start_hour' } }).catch(() => null),
      this.prisma.systemSetting.findUnique({ where: { key: 'work_hours_per_day' } }).catch(() => null),
      this.prisma.hRPolicy.findFirst({ where: { type: 'LATENESS', isActive: true } }).catch(() => null),
    ]);

    return {
      workStartHour: workStartSetting ? Number(workStartSetting.value) : 9,
      workHoursPerDay: workHoursSetting ? Number(workHoursSetting.value) : 8,
      graceMinutes: latenessPolicy?.graceMinutes ?? 30,
    };
  }

  async clockIn(userId: string, dto: ClockInDto, ipAddress?: string) {
    // QR token is required — validates physical presence
    if (!dto.qrToken) {
      throw new BadRequestException('QR code is required to clock in');
    }
    this.validateQrToken(dto.qrToken);

    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already have a record for today
    const existing = await this.prisma.attendance.findUnique({
      where: {
        staffProfileId_date: {
          staffProfileId: staffProfile.id,
          date: today,
        },
      },
    });

    // If already clocked in and NOT clocked out, reject
    if (existing && existing.clockIn && !existing.clockOut) {
      throw new BadRequestException('Already clocked in - please clock out first');
    }

    const now = new Date();
    const { workStartHour, graceMinutes } = await this.getAttendanceThresholds();
    const workStartTime = new Date(today);
    workStartTime.setHours(workStartHour, 0, 0, 0);

    // Determine status based on first clock-in time of the day
    let status: AttendanceStatus = AttendanceStatus.PRESENT;

    // Only set late status on first clock-in of the day
    if (!existing) {
      if (now > workStartTime) {
        const minutesLate = (now.getTime() - workStartTime.getTime()) / (1000 * 60);
        if (minutesLate > graceMinutes) {
          status = AttendanceStatus.LATE;
        }
      }
    } else {
      // Keep the existing status if clocking back in after break
      status = existing.status as AttendanceStatus;
    }

    if (existing) {
      // Clocking back in after a break - clear clockOut, keep accumulated hours
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockIn: now,
          clockOut: null, // Clear clock out to indicate currently working
          status,
          location: dto.location || existing.location,
          ipAddress,
        },
      });
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        staffProfileId: staffProfile.id,
        date: today,
        clockIn: now,
        status,
        location: dto.location,
        ipAddress,
      },
    });

    // Auto-trigger lateness penalty if late (first clock-in of the day)
    if (status === AttendanceStatus.LATE) {
      const minutesLate = Math.floor((now.getTime() - workStartTime.getTime()) / (1000 * 60));
      try {
        await this.policyService.calculateLatenessPenalty(
          staffProfile.id,
          attendance.id,
          minutesLate,
        );
      } catch (error) {
        console.error('Failed to calculate lateness penalty:', error);
      }
    }

    return attendance;
  }

  async clockOut(userId: string, dto: ClockOutDto) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        staffProfileId_date: {
          staffProfileId: staffProfile.id,
          date: today,
        },
      },
    });

    if (!attendance) {
      throw new BadRequestException('No clock-in record found for today');
    }

    if (!attendance.clockIn) {
      throw new BadRequestException('Please clock in first');
    }

    if (attendance.clockOut) {
      throw new BadRequestException('Already clocked out - please clock in first');
    }

    const now = new Date();

    // Calculate hours for this session
    let sessionHours = (now.getTime() - attendance.clockIn.getTime()) / (1000 * 60 * 60);

    // Add to previously accumulated hours (if any)
    const previousHours = attendance.hoursWorked || 0;
    const previousOvertime = attendance.overtime || 0;
    let totalHours = previousHours + sessionHours;
    let overtime = previousOvertime;

    const { workHoursPerDay } = await this.getAttendanceThresholds();
    const halfDayThreshold = workHoursPerDay / 2;

    if (totalHours > workHoursPerDay) {
      overtime = totalHours - workHoursPerDay;
      totalHours = workHoursPerDay;
    }

    // Determine final status based on total hours worked.
    // HALF_DAY takes priority over LATE when the employee works less than half a day —
    // the late penalty is already recorded separately via the penalty system.
    let status = attendance.status;
    if (totalHours < halfDayThreshold) {
      status = AttendanceStatus.HALF_DAY;
    } else if (attendance.status === AttendanceStatus.HALF_DAY) {
      // Accumulated enough hours — restore to PRESENT
      status = AttendanceStatus.PRESENT;
    }
    // LATE status is preserved when hours >= halfDayThreshold (already penalised at clock-in)

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        hoursWorked: Math.round(totalHours * 100) / 100,
        overtime: Math.round(overtime * 100) / 100,
        notes: dto.notes || attendance.notes,
        status,
      },
    });
  }

  async getMyAttendance(userId: string, query: { startDate?: string; endDate?: string }) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const where: any = { staffProfileId: staffProfile.id };

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) where.date.lte = new Date(query.endDate);
    }

    return this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getTodayStatus(userId: string) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        staffProfileId_date: {
          staffProfileId: staffProfile.id,
          date: today,
        },
      },
    });

    return {
      today: today.toISOString(),
      hasRecord: !!attendance,
      isClockedIn: attendance?.clockIn && !attendance?.clockOut,
      record: attendance,
    };
  }

  async findAll(query: AttendanceQueryDto) {
    const { page = 1, limit = 50, staffProfileId, departmentId, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (staffProfileId) {
      where.staffProfileId = staffProfileId;
    }

    if (departmentId) {
      where.staffProfile = { departmentId };
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          staffProfile: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    const data: any = { ...dto };
    if (dto.clockIn) data.clockIn = new Date(dto.clockIn);
    if (dto.clockOut) data.clockOut = new Date(dto.clockOut);

    // Recalculate hours AND re-derive status when clock times are edited by admin
    if (data.clockIn && data.clockOut) {
      let hoursWorked = (data.clockOut.getTime() - data.clockIn.getTime()) / (1000 * 60 * 60);
      if (hoursWorked > 5) hoursWorked -= 1;
      data.hoursWorked = Math.round(hoursWorked * 100) / 100;

      // Only recalculate status when the admin hasn't explicitly set one
      if (!dto.status) {
        const { workStartHour, workHoursPerDay, graceMinutes } = await this.getAttendanceThresholds();
        const halfDayThreshold = workHoursPerDay / 2;
        const workStartTime = new Date(attendance.date);
        workStartTime.setHours(workStartHour, 0, 0, 0);
        const minutesLate = (data.clockIn.getTime() - workStartTime.getTime()) / (1000 * 60);

        if (data.hoursWorked < halfDayThreshold) {
          data.status = AttendanceStatus.HALF_DAY;
        } else if (minutesLate > graceMinutes) {
          data.status = AttendanceStatus.LATE;
        } else {
          data.status = AttendanceStatus.PRESENT;
        }
      }
    }

    const updated = await this.prisma.attendance.update({
      where: { id },
      data,
    });

    // Auto-trigger absence penalty if status changed to ABSENT
    if (
      dto.status === AttendanceStatus.ABSENT &&
      attendance.status !== AttendanceStatus.ABSENT
    ) {
      try {
        await this.policyService.calculateAbsencePenalty(
          attendance.staffProfileId,
          attendance.id,
        );
      } catch (error) {
        console.error('Failed to calculate absence penalty:', error);
      }
    }

    // Auto-trigger lateness penalty if status changed to LATE
    if (
      dto.status === AttendanceStatus.LATE &&
      attendance.status !== AttendanceStatus.LATE
    ) {
      const { workStartHour } = await this.getAttendanceThresholds();
      const workStartTime = new Date(attendance.date);
      workStartTime.setHours(workStartHour, 0, 0, 0);
      const clockInTime = dto.clockIn ? new Date(dto.clockIn) : attendance.clockIn;
      if (clockInTime && clockInTime > workStartTime) {
        const minutesLate = Math.floor((clockInTime.getTime() - workStartTime.getTime()) / (1000 * 60));
        try {
          await this.policyService.calculateLatenessPenalty(
            attendance.staffProfileId,
            attendance.id,
            minutesLate,
          );
        } catch (error) {
          console.error('Failed to calculate lateness penalty:', error);
        }
      }
    }

    return updated;
  }

  async markAbsent(date: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const activeStaff = await this.prisma.staffProfile.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const results: { staffProfileId: string; action: string }[] = [];

    for (const staff of activeStaff) {
      // Skip if attendance already recorded
      const existing = await this.prisma.attendance.findUnique({
        where: { staffProfileId_date: { staffProfileId: staff.id, date: targetDate } },
      });
      if (existing) continue;

      // Skip if approved leave covers this date
      const approvedLeave = await this.prisma.leaveRequest.findFirst({
        where: {
          staffProfileId: staff.id,
          status: 'APPROVED',
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
      });
      if (approvedLeave) continue;

      const record = await this.prisma.attendance.create({
        data: {
          staffProfileId: staff.id,
          date: targetDate,
          status: 'ABSENT',
        },
      });

      try {
        await this.policyService.calculateAbsencePenalty(staff.id, record.id);
      } catch {
        // penalty is best-effort
      }

      results.push({ staffProfileId: staff.id, action: 'ABSENT_CREATED' });
    }

    return { date: targetDate.toISOString().split('T')[0], processed: results.length, results };
  }

  async getReport(query: { departmentId?: string; startDate: string; endDate: string }) {
    const where: any = {
      date: {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      },
    };

    if (query.departmentId) {
      where.staffProfile = { departmentId: query.departmentId };
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        staffProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Group by staff and calculate stats
    const staffStats = new Map();

    for (const record of records) {
      const staffId = record.staffProfileId;
      if (!staffStats.has(staffId)) {
        staffStats.set(staffId, {
          staffProfile: record.staffProfile,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          halfDays: 0,
          wfhDays: 0,
          leaveDays: 0,
          totalHours: 0,
          totalOvertime: 0,
        });
      }

      const stats = staffStats.get(staffId);
      stats.totalHours += record.hoursWorked || 0;
      stats.totalOvertime += record.overtime || 0;

      switch (record.status) {
        case AttendanceStatus.PRESENT:
          stats.presentDays++;
          break;
        case AttendanceStatus.ABSENT:
          stats.absentDays++;
          break;
        case AttendanceStatus.LATE:
          stats.lateDays++;
          break;
        case AttendanceStatus.HALF_DAY:
          stats.halfDays++;
          break;
        case AttendanceStatus.WORK_FROM_HOME:
          stats.wfhDays++;
          break;
        case AttendanceStatus.ON_LEAVE:
          stats.leaveDays++;
          break;
      }
    }

    return Array.from(staffStats.values());
  }
}
