import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CommissionStatus, LoyaltyTier } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly notificationService: NotificationService,
  ) {}

  // Fallback commission rates by tier
  private readonly COMMISSION_RATES = {
    [LoyaltyTier.BRONZE]: 0.03,
    [LoyaltyTier.SILVER]: 0.035,
    [LoyaltyTier.GOLD]: 0.04,
    [LoyaltyTier.PLATINUM]: 0.05,
  };

  async create(data: {
    saleId: string;
    realtorId: string;
    amount: number;
    rate: number;
  }) {
    return this.prisma.commission.create({
      data: {
        ...data,
        status: CommissionStatus.PENDING,
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    realtorId?: string;
    status?: CommissionStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const { realtorId, status, startDate, endDate } = query;
    const pageNum = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limitNum = Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (realtorId) where.realtorId = realtorId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [commissions, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        // Use select (not include) to avoid querying columns that may not exist
        // in older tenant DB schemas (e.g. paymentMethod, paymentReference, paymentNotes)
        select: {
          id: true,
          saleId: true,
          realtorId: true,
          amount: true,
          rate: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
          sale: {
            select: {
              salePrice: true,
              commissionAmount: true,
              taxAmount: true,
              taxRate: true,
              property: {
                select: { title: true, address: true, type: true },
              },
            },
          },
          realtor: {
            select: {
              loyaltyTier: true,
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return {
      data: commissions,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findById(id: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      // Use select to avoid querying potentially-missing columns in older tenant DBs
      select: {
        id: true,
        saleId: true,
        realtorId: true,
        amount: true,
        rate: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        sale: {
          select: {
            salePrice: true,
            commissionAmount: true,
            property: {
              select: { title: true, address: true, type: true, city: true },
            },
            client: {
              select: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        realtor: {
          select: {
            loyaltyTier: true,
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    return commission;
  }

  async markAsPaid(id: string, data?: {
    paymentMethod?: string;
    paymentReference?: string;
    paymentNotes?: string;
  }) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        realtor: {
          select: {
            user: { select: { id: true } },
          },
        },
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    let updated: any;
    try {
      // Attempt full update including all payment metadata + paidAt
      updated = await this.prisma.commission.update({
        where: { id },
        data: {
          status: CommissionStatus.PAID,
          paidAt: new Date(),
          paymentMethod: data?.paymentMethod,
          paymentReference: data?.paymentReference,
          paymentNotes: data?.paymentNotes,
        },
      });
    } catch {
      try {
        // Fallback 1: payment metadata columns may not exist — try with just paidAt
        updated = await this.prisma.commission.update({
          where: { id },
          data: {
            status: CommissionStatus.PAID,
            paidAt: new Date(),
          },
        });
      } catch {
        // Fallback 2: paidAt column may not exist — update only the status
        updated = await this.prisma.commission.update({
          where: { id },
          data: { status: CommissionStatus.PAID },
        });
      }
    }

    // Notify the realtor that their commission has been paid
    const realtorUserId = commission.realtor?.user?.id;
    if (realtorUserId) {
      try {
        await this.notificationService.create({
          userId: realtorUserId,
          type: 'COMMISSION',
          title: 'Commission Paid',
          message: `Your commission of ₦${Number(commission.amount).toLocaleString()} has been paid to your account.`,
          priority: 'HIGH',
          link: '/dashboard/realtor/commission',
        });
      } catch {
        // Notification is best-effort — don't fail the payment update
      }
    }

    return updated;
  }

  async getRealtorCommissions(realtorId: string, query: {
    page?: number;
    limit?: number;
    status?: CommissionStatus;
  }) {
    return this.findAll({ ...query, realtorId });
  }

  async getStats(realtorId?: string) {
    const where = realtorId ? { realtorId } : {};

    const [total, paid, pending, byMonth] = await Promise.all([
      this.prisma.commission.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.commission.aggregate({
        where: { ...where, status: CommissionStatus.PAID },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.commission.aggregate({
        where: { ...where, status: CommissionStatus.PENDING },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.getMonthlyCommissions(realtorId),
    ]);

    return {
      total: {
        amount: total._sum.amount || 0,
        count: total._count.id,
      },
      paid: {
        amount: paid._sum.amount || 0,
        count: paid._count.id,
      },
      pending: {
        amount: pending._sum.amount || 0,
        count: pending._count.id,
      },
      byMonth,
    };
  }

  private async getMonthlyCommissions(realtorId?: string) {
    const months = 12;
    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const where: any = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (realtorId) {
        where.realtorId = realtorId;
      }

      const aggregate = await this.prisma.commission.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      results.push({
        month: startDate.toISOString().slice(0, 7),
        amount: aggregate._sum.amount || 0,
        count: aggregate._count.id,
      });
    }

    return results.reverse();
  }

  getCommissionRate(tier: LoyaltyTier): number {
    return this.COMMISSION_RATES[tier] || 0.03;
  }

  async getCommissionRateFromSettings(tier: LoyaltyTier): Promise<number> {
    try {
      const rates = await this.settingsService.getCommissionRates();
      return rates[tier] ?? this.COMMISSION_RATES[tier] ?? 0.03;
    } catch {
      return this.COMMISSION_RATES[tier] || 0.03;
    }
  }

  async calculateCommission(saleValue: number, tier: LoyaltyTier) {
    const rate = await this.getCommissionRateFromSettings(tier);
    const amount = saleValue * rate;
    const taxRate = await this.settingsService.getMainTaxRate();
    const taxAmount = amount * taxRate;
    const netAmount = amount - taxAmount;

    return {
      rate,
      amount,
      taxRate,
      taxAmount,
      netAmount,
    };
  }
}
