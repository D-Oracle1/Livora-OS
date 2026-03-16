import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { SaleStatus, PayrollStatus } from '@prisma/client';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ======================================================
  // Sales Report
  // ======================================================

  async exportSalesReport(
    res: Response,
    format: 'csv' | 'xlsx',
    query: { startDate?: string; endDate?: string; status?: SaleStatus },
  ): Promise<void> {
    const where: any = {};
    if (query.startDate || query.endDate) {
      where.saleDate = {};
      if (query.startDate) where.saleDate.gte = new Date(query.startDate);
      if (query.endDate) where.saleDate.lte = new Date(query.endDate);
    }
    if (query.status) where.status = query.status;

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        property: { select: { title: true, city: true, type: true } },
        realtor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        client: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
      orderBy: { saleDate: 'desc' },
    });

    const rows = sales.map((s) => ({
      'Sale ID': s.id,
      'Property': s.property?.title ?? '',
      'City': s.property?.city ?? '',
      'Type': s.property?.type ?? '',
      'Sale Price': Number(s.salePrice),
      'Status': s.status,
      'Sale Date': s.saleDate?.toISOString().split('T')[0] ?? '',
      'Realtor': s.realtor ? `${s.realtor.user.firstName} ${s.realtor.user.lastName}` : '',
      'Realtor Email': s.realtor?.user.email ?? '',
      'Client': s.client ? `${s.client.user.firstName} ${s.client.user.lastName}` : '',
      'Client Email': s.client?.user.email ?? '',
      'Commission Amount': Number(s.commissionAmount ?? 0),
      'Commission Rate (%)': Number(s.commissionRate ?? 0) * 100,
      'Created At': s.createdAt.toISOString().split('T')[0],
    }));

    await this.sendExport(res, rows, `sales-report-${Date.now()}`, format);
  }

  // ======================================================
  // Tax Report
  // ======================================================

  async exportTaxReport(
    res: Response,
    format: 'csv' | 'xlsx',
    query: { year?: number; quarter?: number; realtorId?: string },
  ): Promise<void> {
    const where: any = {};
    if (query.year) where.year = query.year;
    if (query.quarter) where.quarter = query.quarter;
    if (query.realtorId) where.realtorId = query.realtorId;

    const taxes = await this.prisma.tax.findMany({
      where,
      include: {
        realtor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        sale: { include: { property: { select: { title: true } } } },
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });

    const rows = taxes.map((t) => ({
      'Tax ID': t.id,
      'Realtor': t.realtor ? `${t.realtor.user.firstName} ${t.realtor.user.lastName}` : '',
      'Realtor Email': t.realtor?.user.email ?? '',
      'Property': t.sale?.property?.title ?? '',
      'Amount': Number(t.amount),
      'Rate (%)': Number(t.rate) * 100,
      'Year': t.year,
      'Quarter': t.quarter,
      'Created At': t.createdAt.toISOString().split('T')[0],
    }));

    await this.sendExport(res, rows, `tax-report-${Date.now()}`, format);
  }

  // ======================================================
  // Payroll Report
  // ======================================================

  async exportPayrollReport(
    res: Response,
    format: 'csv' | 'xlsx',
    query: { month?: number; year?: number; status?: PayrollStatus },
  ): Promise<void> {
    const where: any = {};
    if (query.status) where.status = query.status;
    // Filter by year/month based on periodStart
    if (query.year || query.month) {
      where.periodStart = {};
      if (query.year) {
        const yearStart = new Date(query.year, 0, 1);
        const yearEnd = new Date(query.year, 11, 31);
        where.periodStart.gte = yearStart;
        where.periodStart.lte = yearEnd;
      }
    }

    const payrolls = await this.prisma.payrollRecord.findMany({
      where,
      include: {
        staffProfile: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    const rows = payrolls.map((p) => ({
      'Payroll ID': p.id,
      'Employee': p.staffProfile ? `${p.staffProfile.user.firstName} ${p.staffProfile.user.lastName}` : '',
      'Email': p.staffProfile?.user.email ?? '',
      'Department': p.staffProfile?.department?.name ?? '',
      'Period Start': p.periodStart.toISOString().split('T')[0],
      'Period End': p.periodEnd.toISOString().split('T')[0],
      'Pay Date': p.payDate?.toISOString().split('T')[0] ?? '',
      'Base Salary': Number(p.baseSalary),
      'Overtime': Number(p.overtime ?? 0),
      'Bonus': Number(p.bonus ?? 0),
      'Gross Pay': Number(p.grossPay),
      'Tax Deduction': Number(p.tax ?? 0),
      'Pension Deduction': Number(p.pension ?? 0),
      'Total Deductions': Number(p.totalDeductions),
      'Net Pay': Number(p.netPay),
      'Status': p.status,
    }));

    await this.sendExport(res, rows, `payroll-report-${Date.now()}`, format);
  }

  // ======================================================
  // Audit Log Export
  // ======================================================

  async exportAuditLog(
    res: Response,
    format: 'csv' | 'xlsx',
    query: { startDate?: string; endDate?: string; userId?: string; action?: string },
  ): Promise<void> {
    const where: any = {};
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const rows = logs.map((l) => ({
      'Log ID': l.id,
      'User': l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System',
      'Email': l.user?.email ?? '',
      'Role': l.user?.role ?? '',
      'Action': l.action,
      'Entity': l.entity ?? '',
      'Entity ID': l.entityId ?? '',
      'IP Address': l.ipAddress ?? '',
      'User Agent': l.userAgent ?? '',
      'Timestamp': l.createdAt.toISOString(),
    }));

    await this.sendExport(res, rows, `audit-log-${Date.now()}`, format);
  }

  // ======================================================
  // Commission Report
  // ======================================================

  async exportCommissionReport(
    res: Response,
    format: 'csv' | 'xlsx',
    query: { startDate?: string; endDate?: string; realtorId?: string },
  ): Promise<void> {
    const where: any = {};
    if (query.realtorId) where.realtorId = query.realtorId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const commissions = await this.prisma.commission.findMany({
      where,
      include: {
        realtor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        sale: { include: { property: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = commissions.map((c) => ({
      'Commission ID': c.id,
      'Realtor': c.realtor ? `${c.realtor.user.firstName} ${c.realtor.user.lastName}` : '',
      'Realtor Email': c.realtor?.user.email ?? '',
      'Property': c.sale?.property?.title ?? '',
      'Amount': Number(c.amount),
      'Rate (%)': Number(c.rate) * 100,
      'Status': c.status,
      'Paid At': c.paidAt?.toISOString().split('T')[0] ?? '',
      'Payment Method': c.paymentMethod ?? '',
      'Created At': c.createdAt.toISOString().split('T')[0],
    }));

    await this.sendExport(res, rows, `commission-report-${Date.now()}`, format);
  }

  // ======================================================
  // Shared: build and stream the file
  // ======================================================

  private async sendExport(
    res: Response,
    rows: Record<string, any>[],
    filename: string,
    format: 'csv' | 'xlsx',
  ): Promise<void> {
    if (rows.length === 0) {
      res.status(204).end();
      return;
    }

    const headers = Object.keys(rows[0]);

    if (format === 'csv') {
      const headerLine = headers.map((h) => `"${h}"`).join(',');
      const dataLines = rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] ?? '';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(','),
      );
      const csv = [headerLine, ...dataLines].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Report');

      sheet.columns = headers.map((h) => ({
        header: h,
        key: h,
        width: Math.max(h.length + 4, 16),
      }));

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      };

      rows.forEach((row) => sheet.addRow(row));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    }
  }
}
