import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RankingPeriod, SaleStatus } from '@prisma/client';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateDailyRankings() {
    this.logger.log('Updating daily rankings...');
    await this.calculateRankings('WEEKLY');
  }

  // Run on 1st of every month
  @Cron('0 0 1 * *')
  async updateMonthlyRankings() {
    this.logger.log('Updating monthly rankings...');
    await this.calculateRankings('MONTHLY');
    await this.determineRealtorOfMonth();
  }

  // Run on January 1st
  @Cron('0 0 1 1 *')
  async updateYearlyRankings() {
    this.logger.log('Updating yearly rankings...');
    await this.calculateRankings('YEARLY');
    await this.determineRealtorOfYear();
  }

  async calculateRankings(period: RankingPeriod) {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'WEEKLY':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 7);
        periodEnd = now;
        break;
      case 'MONTHLY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'QUARTERLY':
        const quarter = Math.floor(now.getMonth() / 3);
        periodStart = new Date(now.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'YEARLY':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31);
        break;
      case 'ALL_TIME':
        periodStart = new Date(2000, 0, 1);
        periodEnd = now;
        break;
    }

    // Get sales data for the period (exclude company sales with no realtor)
    const rawSalesData = await this.prisma.sale.groupBy({
      by: ['realtorId'],
      where: {
        realtorId: { not: null },
        status: SaleStatus.COMPLETED,
        saleDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _count: { id: true },
      _sum: { salePrice: true, commissionAmount: true },
    });
    const salesData = rawSalesData.filter(
      (s): s is typeof s & { realtorId: string } => s.realtorId !== null,
    );

    // Calculate scores and sort
    const rankedData = salesData
      .map((data) => ({
        realtorId: data.realtorId,
        totalSales: data._count.id,
        totalValue: Number(data._sum.salePrice || 0),
        totalCommission: Number(data._sum.commissionAmount || 0),
        score: this.calculateScore(data._count.id, Number(data._sum.salePrice || 0)),
      }))
      .sort((a, b) => b.score - a.score);

    // Update rankings
    for (let i = 0; i < rankedData.length; i++) {
      const data = rankedData[i];
      const rank = i + 1;

      // Upsert ranking
      await this.prisma.ranking.upsert({
        where: {
          realtorId_period_periodStart: {
            realtorId: data.realtorId,
            period,
            periodStart,
          },
        },
        update: {
          rank,
          totalSales: data.totalSales,
          totalValue: data.totalValue,
          score: data.score,
        },
        create: {
          realtorId: data.realtorId,
          period,
          periodStart,
          periodEnd,
          rank,
          totalSales: data.totalSales,
          totalValue: data.totalValue,
          score: data.score,
        },
      });

      // Update current rank on realtor profile
      await this.prisma.realtorProfile.update({
        where: { id: data.realtorId },
        data: { currentRank: rank },
      });
    }

    this.logger.log(`Updated ${rankedData.length} rankings for period: ${period}`);
  }

  private calculateScore(salesCount: number, totalValue: number): number {
    // Score formula: (salesCount * 100) + (totalValue / 10000)
    return salesCount * 100 + totalValue / 10000;
  }

  async determineRealtorOfMonth() {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const topRealtor = await this.prisma.ranking.findFirst({
      where: {
        period: 'MONTHLY',
        periodStart: {
          gte: periodStart,
        },
      },
      orderBy: { rank: 'asc' },
    });

    if (topRealtor) {
      // Reset all realtors' isRealtorOfMonth
      await this.prisma.realtorProfile.updateMany({
        data: { isRealtorOfMonth: false },
      });

      // Set the winner
      await this.prisma.realtorProfile.update({
        where: { id: topRealtor.realtorId },
        data: {
          isRealtorOfMonth: true,
          realtorOfMonthCount: { increment: 1 },
        },
      });

      this.logger.log(`Realtor of the Month: ${topRealtor.realtorId}`);
    }
  }

  async determineRealtorOfYear() {
    const now = new Date();
    const periodStart = new Date(now.getFullYear() - 1, 0, 1);

    const topRealtor = await this.prisma.ranking.findFirst({
      where: {
        period: 'YEARLY',
        periodStart: {
          gte: periodStart,
        },
      },
      orderBy: { rank: 'asc' },
    });

    if (topRealtor) {
      // Reset all realtors' isRealtorOfYear
      await this.prisma.realtorProfile.updateMany({
        data: { isRealtorOfYear: false },
      });

      // Set the winner
      await this.prisma.realtorProfile.update({
        where: { id: topRealtor.realtorId },
        data: {
          isRealtorOfYear: true,
          realtorOfYearCount: { increment: 1 },
        },
      });

      this.logger.log(`Realtor of the Year: ${topRealtor.realtorId}`);
    }
  }

  async getLeaderboard(period: RankingPeriod = 'MONTHLY', limit: number = 10) {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'WEEKLY':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 7);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = now;
        break;
      case 'MONTHLY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'QUARTERLY':
        const quarter = Math.floor(now.getMonth() / 3);
        periodStart = new Date(now.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
        break;
      case 'YEARLY':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default: // ALL_TIME
        periodStart = new Date(2000, 0, 1);
        periodEnd = now;
    }

    // First try to get pre-calculated rankings
    const rankings = await this.prisma.ranking.findMany({
      where: {
        period,
        periodStart: { gte: periodStart },
      },
      orderBy: { rank: 'asc' },
      take: limit,
      include: {
        realtor: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
            },
          },
        },
      },
    });

    // If we have pre-calculated rankings, return them
    if (rankings.length > 0) {
      return rankings.map((r) => ({
        rank: r.rank,
        realtorId: r.realtorId,
        userId: r.realtor.user.id,
        name: `${r.realtor.user.firstName} ${r.realtor.user.lastName}`,
        avatar: r.realtor.user.avatar,
        email: r.realtor.user.email,
        tier: r.realtor.loyaltyTier,
        totalSales: r.totalSales,
        totalValue: r.totalValue,
        score: r.score,
        isRealtorOfMonth: r.realtor.isRealtorOfMonth,
        isRealtorOfYear: r.realtor.isRealtorOfYear,
      }));
    }

    // Fallback: Calculate rankings in real-time from sales data
    this.logger.log(`No pre-calculated rankings found for ${period}, calculating from sales data...`);

    const rawSalesData = await this.prisma.sale.groupBy({
      by: ['realtorId'],
      where: {
        realtorId: { not: null },
        status: SaleStatus.COMPLETED,
        saleDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _count: { id: true },
      _sum: { salePrice: true, commissionAmount: true },
    });
    // Narrow type: realtorId is guaranteed non-null by the where filter above
    const salesData = rawSalesData.filter(
      (s): s is typeof s & { realtorId: string } => s.realtorId !== null,
    );

    if (salesData.length === 0) {
      // No sales data, try to return all realtors with zero sales
      const allRealtors = await this.prisma.realtorProfile.findMany({
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
          },
        },
        orderBy: { totalSales: 'desc' },
      });

      return allRealtors.map((r, index) => ({
        rank: index + 1,
        realtorId: r.id,
        userId: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`,
        avatar: r.user.avatar,
        email: r.user.email,
        tier: r.loyaltyTier,
        totalSales: r.totalSales,
        totalValue: Number(r.totalSalesValue || 0),
        score: this.calculateScore(r.totalSales, Number(r.totalSalesValue || 0)),
        isRealtorOfMonth: r.isRealtorOfMonth,
        isRealtorOfYear: r.isRealtorOfYear,
      }));
    }

    // Get realtor details for the sales data
    const realtorIds = salesData.map(s => s.realtorId);
    const realtors = await this.prisma.realtorProfile.findMany({
      where: { id: { in: realtorIds } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
        },
      },
    });

    const realtorMap = new Map(realtors.map(r => [r.id, r]));

    // Calculate scores and sort
    const rankedData = salesData
      .map((data) => {
        const realtor = realtorMap.get(data.realtorId);
        if (!realtor) return null;

        return {
          realtorId: data.realtorId,
          userId: realtor.user.id,
          name: `${realtor.user.firstName} ${realtor.user.lastName}`,
          avatar: realtor.user.avatar,
          email: realtor.user.email,
          tier: realtor.loyaltyTier,
          totalSales: data._count.id,
          totalValue: Number(data._sum.salePrice || 0),
          score: this.calculateScore(data._count.id, Number(data._sum.salePrice || 0)),
          isRealtorOfMonth: realtor.isRealtorOfMonth,
          isRealtorOfYear: realtor.isRealtorOfYear,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, limit)
      .map((data, index) => ({
        ...data!,
        rank: index + 1,
      }));

    return rankedData;
  }

  async getRealtorRanking(realtorId: string) {
    const rankings = await this.prisma.ranking.findMany({
      where: { realtorId },
      orderBy: { periodEnd: 'desc' },
      take: 12,
    });

    const currentRank = await this.prisma.realtorProfile.findUnique({
      where: { id: realtorId },
      select: {
        currentRank: true,
        isRealtorOfMonth: true,
        isRealtorOfYear: true,
        realtorOfMonthCount: true,
        realtorOfYearCount: true,
      },
    });

    return {
      ...currentRank,
      history: rankings,
    };
  }

  async getRealtorOfMonth() {
    return this.prisma.realtorProfile.findFirst({
      where: { isRealtorOfMonth: true },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
      },
    });
  }

  async getRealtorOfYear() {
    return this.prisma.realtorProfile.findFirst({
      where: { isRealtorOfYear: true },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
      },
    });
  }
}
