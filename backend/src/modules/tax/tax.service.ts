import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SaleStatus } from '@prisma/client';

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(data: {
    saleId: string;
    realtorId: string;
    amount: number;
    rate: number;
    year: number;
    quarter: number;
  }) {
    return this.prisma.tax.create({
      data,
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    realtorId?: string;
    year?: number;
    quarter?: number;
  }) {
    const pageNum = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limitNum = Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20);
    const skip = (pageNum - 1) * limitNum;
    const { realtorId, year, quarter } = query;

    const where: any = {};

    if (realtorId) where.realtorId = realtorId;
    if (year) where.year = Number(year);
    if (quarter) where.quarter = Number(quarter);

    const [taxes, total] = await Promise.all([
      this.prisma.tax.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
        include: {
          sale: {
            include: {
              property: {
                select: { title: true, address: true },
              },
            },
          },
          realtor: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      }),
      this.prisma.tax.count({ where }),
    ]);

    return {
      data: taxes,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findById(id: string) {
    const tax = await this.prisma.tax.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            property: true,
          },
        },
        realtor: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!tax) {
      throw new NotFoundException('Tax record not found');
    }

    return tax;
  }

  async getStats(realtorId?: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    const where = realtorId ? { realtorId } : {};

    const [total, currentYearTax, currentQuarterTax, byYear, byQuarter] = await Promise.all([
      this.prisma.tax.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.tax.aggregate({
        where: { ...where, year: currentYear },
        _sum: { amount: true },
      }),
      this.prisma.tax.aggregate({
        where: { ...where, year: currentYear, quarter: currentQuarter },
        _sum: { amount: true },
      }),
      this.getTaxByYear(realtorId),
      this.getTaxByQuarter(currentYear, realtorId),
    ]);

    return {
      total: {
        amount: total._sum.amount || 0,
        count: total._count.id,
      },
      currentYear: {
        year: currentYear,
        amount: currentYearTax._sum.amount || 0,
      },
      currentQuarter: {
        year: currentYear,
        quarter: currentQuarter,
        amount: currentQuarterTax._sum.amount || 0,
      },
      byYear,
      byQuarter,
      taxRate: await this.settingsService.getMainTaxRate(),
    };
  }

  private async getTaxByYear(realtorId?: string) {
    const years = 5;
    const now = new Date();
    const results = [];

    for (let i = 0; i < years; i++) {
      const year = now.getFullYear() - i;

      const where: any = { year };
      if (realtorId) {
        where.realtorId = realtorId;
      }

      const aggregate = await this.prisma.tax.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      results.push({
        year,
        amount: aggregate._sum.amount || 0,
        count: aggregate._count.id,
      });
    }

    return results;
  }

  private async getTaxByQuarter(year: number, realtorId?: string) {
    const quarters = [1, 2, 3, 4];
    const results = [];

    for (const quarter of quarters) {
      const where: any = { year, quarter };
      if (realtorId) {
        where.realtorId = realtorId;
      }

      const aggregate = await this.prisma.tax.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      results.push({
        quarter,
        amount: aggregate._sum.amount || 0,
        count: aggregate._count.id,
      });
    }

    return results;
  }

  async getRealtorTaxReport(realtorId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();

    const taxes = await this.prisma.tax.findMany({
      where: {
        realtorId,
        year: targetYear,
      },
      orderBy: { quarter: 'asc' },
      include: {
        sale: {
          include: {
            property: {
              select: { title: true, address: true },
            },
          },
        },
      },
    });

    const total = taxes.reduce((sum, t) => sum + Number(t.amount), 0);
    const byQuarter = [1, 2, 3, 4].map((q) => ({
      quarter: q,
      amount: taxes
        .filter((t) => t.quarter === q)
        .reduce((sum, t) => sum + Number(t.amount), 0),
      transactions: taxes.filter((t) => t.quarter === q).length,
    }));

    return {
      year: targetYear,
      total,
      byQuarter,
      transactions: taxes,
    };
  }

  async calculateTaxFromSettings(commissionAmount: number): Promise<number> {
    const rate = await this.settingsService.getMainTaxRate();
    return commissionAmount * rate;
  }

  /**
   * Use approved/completed Sales (with a realtorId) as the authoritative source.
   * This handles sales that were approved before the commission table was populated.
   * For each qualifying sale:
   *   - Ensures a Commission record exists (upserts it)
   *   - Upserts the Tax record using the CURRENT settings rate
   *   - Corrects sale.taxRate / taxAmount / netAmount for consistency
   */
  async updateAllTaxRecords(): Promise<{ updated: number; created: number }> {
    const taxRate = await this.settingsService.getMainTaxRate();

    const sales = await this.prisma.sale.findMany({
      where: {
        realtorId: { not: null },
        status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
      },
      select: {
        id: true,
        realtorId: true,
        commissionAmount: true,
        commissionRate: true,
        saleDate: true,
      },
    });

    let updated = 0;
    let created = 0;

    for (const sale of sales) {
      const commissionAmount = Number(sale.commissionAmount ?? 0);
      const taxAmount        = commissionAmount * taxRate;
      const netAmount        = commissionAmount - taxAmount;
      const saleDate         = sale.saleDate ? new Date(sale.saleDate) : new Date();
      const year             = saleDate.getFullYear();
      const quarter          = Math.floor(saleDate.getMonth() / 3) + 1;

      // Correct the sale's tax figures
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: { taxRate, taxAmount, netAmount },
      });

      // Ensure a Commission record exists for this sale
      await this.prisma.commission.upsert({
        where: { saleId: sale.id },
        update: { amount: commissionAmount },
        create: {
          saleId: sale.id,
          realtorId: sale.realtorId!,
          amount: commissionAmount,
          rate: sale.commissionRate,
          status: 'PENDING',
        },
      });

      // Upsert the Tax record
      const existing = await this.prisma.tax.findUnique({ where: { saleId: sale.id } });
      if (existing) {
        await this.prisma.tax.update({
          where: { saleId: sale.id },
          data: { amount: taxAmount, rate: taxRate },
        });
        updated++;
      } else {
        await this.prisma.tax.create({
          data: {
            saleId: sale.id,
            realtorId: sale.realtorId!,
            amount: taxAmount,
            rate: taxRate,
            year,
            quarter,
          },
        });
        created++;
      }
    }

    return { updated, created };
  }
}
