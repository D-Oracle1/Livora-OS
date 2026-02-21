import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GeneratePayrollDto, UpdatePayrollDto, ApprovePayrollDto, PayrollQueryDto } from '../dto/payroll.dto';
import { PayrollStatus } from '@prisma/client';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly TAX_RATE = 0.075; // 7.5% PAYE
  private readonly PENSION_RATE = 0.08; // 8% Pension

  async generate(dto: GeneratePayrollDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    // Get staff members to generate payroll for
    const where: any = { isActive: true };
    if (dto.departmentIds && dto.departmentIds.length > 0) {
      where.departmentId = { in: dto.departmentIds };
    }

    const staffMembers = await this.prisma.staffProfile.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        department: {
          select: { name: true },
        },
      },
    });

    const payrollRecords = [];

    for (const staff of staffMembers) {
      // Check if payroll already exists for this period
      const existing = await this.prisma.payrollRecord.findUnique({
        where: {
          staffProfileId_periodStart_periodEnd: {
            staffProfileId: staff.id,
            periodStart,
            periodEnd,
          },
        },
      });

      if (existing) {
        continue; // Skip if already exists
      }

      // Calculate overtime from attendance
      const attendance = await this.prisma.attendance.findMany({
        where: {
          staffProfileId: staff.id,
          date: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      const totalOvertime = attendance.reduce((sum, a) => sum + (a.overtime || 0), 0);
      const overtimeAmount = (Number(staff.baseSalary) / 160) * totalOvertime * 1.5; // 1.5x rate for overtime

      // Calculate deductions
      const grossPay = Number(staff.baseSalary) + overtimeAmount;
      const tax = grossPay * this.TAX_RATE;
      const pension = grossPay * this.PENSION_RATE;
      const totalDeductions = tax + pension;
      const netPay = grossPay - totalDeductions;

      const payroll = await this.prisma.payrollRecord.create({
        data: {
          staffProfileId: staff.id,
          periodStart,
          periodEnd,
          baseSalary: staff.baseSalary,
          overtime: overtimeAmount,
          bonus: 0,
          grossPay,
          tax,
          pension,
          totalDeductions,
          netPay,
          currency: staff.currency,
          status: PayrollStatus.DRAFT,
        },
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

      payrollRecords.push(payroll);
    }

    return {
      generated: payrollRecords.length,
      records: payrollRecords,
    };
  }

  async findAll(query: PayrollQueryDto) {
    const { staffProfileId, departmentId, status, periodStart, periodEnd } = query;
    const pageNum = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limitNum = Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (staffProfileId) where.staffProfileId = staffProfileId;
    if (departmentId) where.staffProfile = { departmentId };
    if (status) where.status = status;
    if (periodStart) where.periodStart = { gte: new Date(periodStart) };
    if (periodEnd) where.periodEnd = { lte: new Date(periodEnd) };

    const [records, total] = await Promise.all([
      this.prisma.payrollRecord.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { periodEnd: 'desc' },
        include: {
          staffProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true, avatar: true },
              },
              department: {
                select: { name: true },
              },
            },
          },
        },
      }),
      this.prisma.payrollRecord.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findById(id: string) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        staffProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
            department: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    return record;
  }

  async update(id: string, dto: UpdatePayrollDto) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (record.status === PayrollStatus.PAID) {
      throw new BadRequestException('Cannot update paid payroll');
    }

    // Recalculate totals
    const overtime = dto.overtime ?? Number(record.overtime);
    const bonus = dto.bonus ?? Number(record.bonus);
    const allowances = dto.allowances || (record.allowances as Record<string, number>) || {};
    const otherDeductions = dto.otherDeductions || (record.otherDeductions as Record<string, number>) || {};

    const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + val, 0);
    const totalOtherDeductions = Object.values(otherDeductions).reduce((sum, val) => sum + val, 0);

    const grossPay = Number(record.baseSalary) + overtime + bonus + totalAllowances;
    const tax = grossPay * this.TAX_RATE;
    const pension = grossPay * this.PENSION_RATE;
    const totalDeductions = tax + pension + totalOtherDeductions;
    const netPay = grossPay - totalDeductions;

    return this.prisma.payrollRecord.update({
      where: { id },
      data: {
        overtime,
        bonus,
        allowances,
        grossPay,
        tax,
        pension,
        otherDeductions,
        totalDeductions,
        netPay,
      },
      include: {
        staffProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });
  }

  async approve(id: string, approverId: string, dto: ApprovePayrollDto) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (record.status !== PayrollStatus.DRAFT && record.status !== PayrollStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Payroll is not in approvable state');
    }

    return this.prisma.payrollRecord.update({
      where: { id },
      data: {
        status: PayrollStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: new Date(),
        payDate: dto.payDate ? new Date(dto.payDate) : undefined,
      },
    });
  }

  async bulkApprove(ids: string[], approverId: string, payDate?: string) {
    const results = [];

    for (const id of ids) {
      try {
        const result = await this.approve(id, approverId, { payDate });
        results.push({ id, success: true, record: result });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return results;
  }

  async markAsPaid(id: string) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (record.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException('Payroll must be approved before marking as paid');
    }

    return this.prisma.payrollRecord.update({
      where: { id },
      data: {
        status: PayrollStatus.PAID,
        paidAt: new Date(),
      },
    });
  }

  async getMyPayslips(userId: string) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.prisma.payrollRecord.findMany({
      where: {
        staffProfileId: staffProfile.id,
        status: { in: [PayrollStatus.APPROVED, PayrollStatus.PAID] },
      },
      orderBy: { periodEnd: 'desc' },
    });
  }

  async getSummary(query: { periodStart: string; periodEnd: string; departmentId?: string }) {
    const where: any = {
      periodStart: { gte: new Date(query.periodStart) },
      periodEnd: { lte: new Date(query.periodEnd) },
    };

    if (query.departmentId) {
      where.staffProfile = { departmentId: query.departmentId };
    }

    const records = await this.prisma.payrollRecord.findMany({
      where,
      include: {
        staffProfile: {
          include: {
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    const summary = {
      totalRecords: records.length,
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalTax: 0,
      totalPension: 0,
      byStatus: {} as Record<string, number>,
      byDepartment: {} as Record<string, { count: number; total: number }>,
    };

    for (const record of records) {
      summary.totalGrossPay += Number(record.grossPay);
      summary.totalDeductions += Number(record.totalDeductions);
      summary.totalNetPay += Number(record.netPay);
      summary.totalTax += Number(record.tax);
      summary.totalPension += Number(record.pension);

      // By status
      summary.byStatus[record.status] = (summary.byStatus[record.status] || 0) + 1;

      // By department
      const deptName = record.staffProfile.department?.name || 'Unknown';
      if (!summary.byDepartment[deptName]) {
        summary.byDepartment[deptName] = { count: 0, total: 0 };
      }
      summary.byDepartment[deptName].count++;
      summary.byDepartment[deptName].total += Number(record.netPay);
    }

    return summary;
  }
}
