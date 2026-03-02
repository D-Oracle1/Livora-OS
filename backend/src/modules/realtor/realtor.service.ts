import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateRealtorDto } from './dto/update-realtor.dto';
import { SaleStatus, LoyaltyTier } from '@prisma/client';
import { DashboardPeriod, getDateRange, groupSalesIntoChartBuckets } from '../../common/utils/date-range.util';

@Injectable()
export class RealtorService {
  constructor(private readonly prisma: PrismaService) {}

  async getDirectory() {
    return this.prisma.realtorProfile.findMany({
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    tier?: LoyaltyTier;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, limit = 20, search, tier, sortBy = 'currentRank', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tier) {
      where.loyaltyTier = tier;
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [realtors, total] = await Promise.all([
      this.prisma.realtorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              status: true,
            },
          },
          _count: {
            select: {
              sales: true,
              clients: true,
              properties: true,
            },
          },
        },
      }),
      this.prisma.realtorProfile.count({ where }),
    ]);

    return {
      data: realtors,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const realtor = await this.prisma.realtorProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            sales: true,
            clients: true,
            properties: true,
          },
        },
      },
    });

    if (!realtor) {
      throw new NotFoundException('Realtor not found');
    }

    return realtor;
  }

  async findByUserId(userId: string) {
    const realtor = await this.prisma.realtorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            status: true,
          },
        },
      },
    });

    if (!realtor) {
      throw new NotFoundException('Realtor profile not found');
    }

    return realtor;
  }

  async getDashboard(userId: string, period?: DashboardPeriod, month?: number, year?: number) {
    const realtor = await this.findByUserId(userId);

    const activePeriod: DashboardPeriod = period || 'monthly';
    const parsedMonth = month !== undefined && !isNaN(Number(month)) ? Number(month) : undefined;
    const parsedYear = year !== undefined && !isNaN(Number(year)) ? Number(year) : undefined;
    const { startDate, endDate } = getDateRange(activePeriod, parsedMonth, parsedYear);
    const dateFilter = { gte: startDate, lte: endDate };

    const [
      filteredSalesCount,
      filteredRevenue,
      filteredCommission,
      filteredTax,
      salesForChart,
      recentSales,
      clients,
      properties,
    ] = await Promise.all([
      this.prisma.sale.count({
        where: {
          realtorId: realtor.id,
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
      }),
      this.prisma.sale.aggregate({
        where: {
          realtorId: realtor.id,
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        _sum: { salePrice: true, commissionAmount: true, taxAmount: true },
      }),
      this.prisma.commission.aggregate({
        where: {
          realtorId: realtor.id,
          sale: { saleDate: dateFilter },
        },
        _sum: { amount: true },
      }),
      this.prisma.tax.aggregate({
        where: {
          realtorId: realtor.id,
          sale: { saleDate: dateFilter },
        },
        _sum: { amount: true },
      }),
      this.prisma.sale.findMany({
        where: {
          realtorId: realtor.id,
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        select: { saleDate: true, salePrice: true, commissionAmount: true },
        orderBy: { saleDate: 'asc' },
      }),
      this.prisma.sale.findMany({
        where: { realtorId: realtor.id, saleDate: dateFilter },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          property: { select: { title: true, address: true } },
          client: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.clientProfile.count({
        where: { realtorId: realtor.id },
      }),
      this.prisma.property.count({
        where: { realtorId: realtor.id },
      }),
    ]);

    const chartData = groupSalesIntoChartBuckets(salesForChart, activePeriod, startDate, endDate);
    const filteredCommissionAmount = filteredCommission._sum.amount || filteredRevenue._sum.commissionAmount || 0;
    const filteredTaxAmount = filteredTax._sum.amount || filteredRevenue._sum.taxAmount || 0;

    return {
      profile: realtor,
      stats: {
        totalSales: realtor.totalSales,
        filteredSales: filteredSalesCount,
        totalSalesValue: realtor.totalSalesValue,
        filteredRevenue: filteredRevenue._sum.salePrice || 0,
        totalCommission: realtor.totalCommission,
        filteredCommission: filteredCommissionAmount,
        totalTaxPaid: realtor.totalTaxPaid,
        filteredTax: filteredTaxAmount,
        netEarnings: Number(realtor.totalCommission) - Number(realtor.totalTaxPaid),
        filteredNetEarnings: Number(filteredCommissionAmount) - Number(filteredTaxAmount),
        clients,
        properties,
      },
      loyalty: {
        tier: realtor.loyaltyTier,
        points: realtor.loyaltyPoints,
        rank: realtor.currentRank,
        isRealtorOfMonth: realtor.isRealtorOfMonth,
        isRealtorOfYear: realtor.isRealtorOfYear,
        achievements: realtor.achievements,
      },
      chartData,
      recentSales,
      period: activePeriod,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  async update(id: string, updateRealtorDto: UpdateRealtorDto) {
    const realtor = await this.prisma.realtorProfile.findUnique({
      where: { id },
    });

    if (!realtor) {
      throw new NotFoundException('Realtor not found');
    }

    return this.prisma.realtorProfile.update({
      where: { id },
      data: updateRealtorDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getLeaderboard(period: 'monthly' | 'yearly' | 'all-time' = 'monthly', limit: number = 10) {
    const now = new Date();
    let startDate: Date | undefined;

    if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const where = startDate
      ? {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: { gte: startDate },
        }
      : { status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] } };

    const salesByRealtor = await this.prisma.sale.groupBy({
      by: ['realtorId'],
      where,
      _count: { id: true },
      _sum: { salePrice: true, commissionAmount: true },
      orderBy: { _sum: { salePrice: 'desc' } },
      take: limit,
    });

    const realtorIds = salesByRealtor.map((s) => s.realtorId);
    const realtors = await this.prisma.realtorProfile.findMany({
      where: { id: { in: realtorIds } },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return salesByRealtor.map((s, index) => {
      const realtor = realtors.find((r) => r.id === s.realtorId);
      return {
        rank: index + 1,
        realtorId: s.realtorId,
        name: `${realtor?.user.firstName} ${realtor?.user.lastName}`,
        avatar: realtor?.user.avatar,
        tier: realtor?.loyaltyTier,
        salesCount: s._count.id,
        totalRevenue: s._sum.salePrice,
        totalCommission: s._sum.commissionAmount,
      };
    });
  }

  async getClients(realtorId: string, query: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { realtorId };

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [clients, total] = await Promise.all([
      this.prisma.clientProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              ownedProperties: true,
              purchases: true,
            },
          },
        },
      }),
      this.prisma.clientProfile.count({ where }),
    ]);

    return {
      data: clients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProperties(realtorId: string, query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { realtorId };

    if (status) {
      where.status = status;
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
