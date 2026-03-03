import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { SaleStatus, PropertyStatus, LoyaltyTier } from '@prisma/client';
import { DashboardPeriod, getDateRange, groupSalesIntoChartBuckets } from '../../common/utils/date-range.util';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getDashboardStats(
    period?: DashboardPeriod,
    month?: number,
    year?: number,
  ) {
    const activePeriod: DashboardPeriod = period || 'monthly';
    const parsedMonth = month !== undefined && !isNaN(Number(month)) ? Number(month) : undefined;
    const parsedYear = year !== undefined && !isNaN(Number(year)) ? Number(year) : undefined;

    const cacheKey = `admin:dash:${activePeriod}:${parsedMonth ?? 'all'}:${parsedYear ?? 'all'}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = getDateRange(activePeriod, parsedMonth, parsedYear);
    const dateFilter = { gte: startDate, lte: endDate };

    const [
      totalRealtors,
      activeRealtors,
      totalClients,
      totalProperties,
      activeListings,
      filteredSalesCount,
      filteredRevenue,
      filteredCommission,
      pendingSales,
      salesForChart,
      recentSales,
      tierDistribution,
    ] = await Promise.all([
      this.prisma.realtorProfile.count(),
      this.prisma.realtorProfile.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      this.prisma.clientProfile.count(),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { isListed: true } }),
      // Count completed + in-progress sales for the period
      this.prisma.sale.count({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
      }),
      // Revenue from completed + in-progress sales
      this.prisma.sale.aggregate({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        _sum: { salePrice: true, commissionAmount: true },
      }),
      // Commission from completed + in-progress sales in the period
      this.prisma.commission.aggregate({
        where: {
          sale: { saleDate: dateFilter },
        },
        _sum: { amount: true },
      }),
      this.prisma.sale.count({ where: { status: SaleStatus.PENDING } }),
      // Chart data from completed + in-progress sales
      this.prisma.sale.findMany({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        select: { saleDate: true, salePrice: true, commissionAmount: true },
        orderBy: { saleDate: 'asc' },
      }),
      this.prisma.sale.findMany({
        where: { saleDate: dateFilter },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          property: { select: { title: true, type: true, address: true } },
          realtor: { include: { user: { select: { firstName: true, lastName: true } } } },
          client: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.realtorProfile.groupBy({
        by: ['loyaltyTier'],
        _count: { id: true },
      }),
    ]);

    const chartData = groupSalesIntoChartBuckets(salesForChart, activePeriod, startDate, endDate);

    // Convert tier distribution to object
    const tierDistributionMap = tierDistribution.reduce((acc, item) => {
      acc[item.loyaltyTier] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const result = {
      realtors: { total: totalRealtors, active: activeRealtors },
      clients: { total: totalClients },
      properties: { total: totalProperties, activeListings },
      sales: {
        filtered: filteredSalesCount,
        pending: pendingSales,
      },
      revenue: {
        filtered: filteredRevenue._sum.salePrice || 0,
      },
      commission: {
        filtered: filteredCommission._sum.amount || 0,
        filteredFromSales: filteredRevenue._sum.commissionAmount || 0,
      },
      chartData,
      recentSales,
      tierDistribution: tierDistributionMap,
      period: activePeriod,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    await this.cacheService.set(cacheKey, result, 60);
    return result;
  }

  async getRealtorMonitoring(query: {
    page?: number;
    limit?: number;
    search?: string;
    tier?: LoyaltyTier;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, limit = 20, search, tier, sortBy = 'totalSales', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (tier) {
      where.loyaltyTier = tier;
    }

    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.user = { firstName: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

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
              lastLoginAt: true,
            },
          },
          _count: {
            select: {
              sales: true,
              clients: true,
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

  async getRealtorDrilldown(realtorId: string) {
    const realtor = await this.prisma.realtorProfile.findUnique({
      where: { id: realtorId },
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
            lastLoginAt: true,
          },
        },
        sales: {
          orderBy: { saleDate: 'desc' },
          take: 10,
          include: {
            property: true,
            client: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        clients: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        rankings: {
          orderBy: { periodEnd: 'desc' },
          take: 12,
        },
      },
    });

    if (!realtor) {
      throw new Error('Realtor not found');
    }

    // Get monthly performance
    const monthlyPerformance = await this.getRealtorMonthlyPerformance(realtorId);

    return {
      ...realtor,
      monthlyPerformance,
    };
  }

  async getRealtorMonthlyPerformance(realtorId: string) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Single query instead of 24
    const sales = await this.prisma.sale.findMany({
      where: {
        realtorId,
        status: SaleStatus.COMPLETED,
        saleDate: { gte: startDate },
      },
      select: { saleDate: true, salePrice: true },
    });

    // Bucket into months in JS
    const buckets = new Map<string, { sales: number; revenue: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(d.toISOString().slice(0, 7), { sales: 0, revenue: 0 });
    }
    for (const s of sales) {
      const key = new Date(s.saleDate).toISOString().slice(0, 7);
      const b = buckets.get(key);
      if (b) {
        b.sales += 1;
        b.revenue += Number(s.salePrice || 0);
      }
    }

    return Array.from(buckets.entries()).map(([month, data]) => ({
      month,
      sales: data.sales,
      revenue: data.revenue,
    }));
  }

  async getRecentSalesFeed(limit: number = 20) {
    return this.prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        property: {
          select: {
            title: true,
            address: true,
            city: true,
          },
        },
        realtor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        client: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async getPerformanceAnalytics(
    period: 'week' | 'month' | 'quarter' | 'year',
    year?: number,
    month?: number,
  ) {
    const now = new Date();
    const selectedYear = year !== undefined && !isNaN(Number(year)) ? Number(year) : now.getFullYear();
    const selectedMonth = month !== undefined && !isNaN(Number(month)) ? Number(month) : now.getMonth();

    const cacheKey = `admin:perf:${period}:${selectedMonth}:${selectedYear}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'week':
        // For week, use current week from the specified year's context
        const baseDate = new Date(selectedYear, selectedMonth, now.getDate());
        startDate = new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = baseDate;
        break;
      case 'month':
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
        break;
      case 'quarter':
        const quarter = Math.floor(selectedMonth / 3);
        startDate = new Date(selectedYear, quarter * 3, 1);
        endDate = new Date(selectedYear, quarter * 3 + 3, 0, 23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        break;
    }

    const dateFilter = { gte: startDate, lte: endDate };

    const [
      salesByRealtor,
      topProperties,
      tierDistribution,
      totalStats,
      salesWithPropertyInfo,
      newClientsCount,
    ] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['realtorId'],
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        _count: { id: true },
        _sum: { salePrice: true, commissionAmount: true },
        orderBy: { _sum: { salePrice: 'desc' } },
        take: 10,
      }),
      this.prisma.sale.findMany({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        orderBy: { salePrice: 'desc' },
        take: 10,
        include: {
          property: true,
          realtor: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      }),
      this.prisma.realtorProfile.groupBy({
        by: ['loyaltyTier'],
        _count: { id: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        _count: { id: true },
        _sum: { salePrice: true, commissionAmount: true },
      }),
      // Get all sales with property info for aggregation
      this.prisma.sale.findMany({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        select: {
          saleDate: true,
          salePrice: true,
          property: {
            select: {
              type: true,
              city: true,
            },
          },
        },
        orderBy: { saleDate: 'asc' },
      }),
      // New clients in period
      this.prisma.clientProfile.count({
        where: {
          createdAt: dateFilter,
        },
      }),
    ]);

    // Process sales by property type (replaces raw SQL)
    const propertyTypeMap = new Map<string, { count: number; revenue: number }>();
    for (const sale of salesWithPropertyInfo) {
      const type = sale.property?.type || 'Unknown';
      const existing = propertyTypeMap.get(type) || { count: 0, revenue: 0 };
      propertyTypeMap.set(type, {
        count: existing.count + 1,
        revenue: existing.revenue + Number(sale.salePrice || 0),
      });
    }
    const salesByPropertyType = Array.from(propertyTypeMap.entries())
      .map(([type, data]) => ({ type, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Process sales by location (replaces raw SQL)
    const locationMap = new Map<string, { sales: number; totalPrice: number }>();
    for (const sale of salesWithPropertyInfo) {
      const location = sale.property?.city || 'Unknown';
      const existing = locationMap.get(location) || { sales: 0, totalPrice: 0 };
      locationMap.set(location, {
        sales: existing.sales + 1,
        totalPrice: existing.totalPrice + Number(sale.salePrice || 0),
      });
    }
    const salesByLocation = Array.from(locationMap.entries())
      .map(([location, data]) => ({
        location,
        sales: data.sales,
        avgPrice: data.sales > 0 ? data.totalPrice / data.sales : 0,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Use salesWithPropertyInfo for chart data
    const salesForChart = salesWithPropertyInfo;

    // Get realtor details for top performers
    const topRealtorIds = salesByRealtor.map((s) => s.realtorId).filter((id): id is string => id !== null);
    const topRealtors = await this.prisma.realtorProfile.findMany({
      where: { id: { in: topRealtorIds } },
      include: {
        user: {
          select: { firstName: true, lastName: true, avatar: true },
        },
      },
    });

    const topPerformers = salesByRealtor.map((s) => {
      const realtor = topRealtors.find((r) => r.id === s.realtorId);
      return {
        realtorId: s.realtorId,
        realtor: realtor?.user,
        salesCount: s._count.id,
        totalRevenue: s._sum.salePrice,
        totalCommission: s._sum.commissionAmount,
      };
    });

    // Process chart data based on period
    const chartData = this.processChartData(salesForChart, period, startDate, endDate);

    // Calculate property type percentages
    const totalPropertySales = salesByPropertyType.reduce((sum, pt) => sum + pt.count, 0) || 1;
    const propertyTypes = salesByPropertyType.map((pt) => ({
      type: pt.type,
      count: pt.count,
      percentage: Math.round((pt.count / totalPropertySales) * 100),
      revenue: pt.revenue,
    }));

    // Summary stats
    const stats = {
      totalRevenue: Number(totalStats._sum.salePrice || 0),
      propertiesSold: totalStats._count.id || 0,
      newClients: newClientsCount,
      avgSalePrice: totalStats._count.id > 0
        ? Number(totalStats._sum.salePrice || 0) / totalStats._count.id
        : 0,
    };

    const result = {
      stats,
      chartData,
      propertyTypes,
      topLocations: salesByLocation,
      topPerformers,
      topProperties,
      tierDistribution: tierDistribution.reduce((acc, item) => {
        acc[item.loyaltyTier] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      period,
      year: selectedYear,
      month: selectedMonth,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    await this.cacheService.set(cacheKey, result, 60);
    return result;
  }

  private processChartData(
    sales: { saleDate: Date; salePrice: any }[],
    period: string,
    startDate: Date,
    endDate: Date,
  ) {
    const chartData: { label: string; sales: number; revenue: number }[] = [];

    if (period === 'week') {
      // Group by day
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        const daySales = sales.filter((s) => {
          const saleDate = new Date(s.saleDate);
          return saleDate.toDateString() === date.toDateString();
        });
        chartData.push({
          label: dayLabel,
          sales: daySales.length,
          revenue: daySales.reduce((sum, s) => sum + Number(s.salePrice || 0), 0),
        });
      }
    } else if (period === 'month') {
      // Group by week
      const weeks = 4;
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekSales = sales.filter((s) => {
          const saleDate = new Date(s.saleDate);
          return saleDate >= weekStart && saleDate <= weekEnd;
        });
        chartData.push({
          label: `Week ${i + 1}`,
          sales: weekSales.length,
          revenue: weekSales.reduce((sum, s) => sum + Number(s.salePrice || 0), 0),
        });
      }
    } else if (period === 'quarter') {
      // Group by month
      const quarterStart = startDate.getMonth();
      for (let i = 0; i < 3; i++) {
        const monthSales = sales.filter((s) => {
          const saleDate = new Date(s.saleDate);
          return saleDate.getMonth() === quarterStart + i;
        });
        const monthName = new Date(startDate.getFullYear(), quarterStart + i, 1)
          .toLocaleDateString('en-US', { month: 'short' });
        chartData.push({
          label: monthName,
          sales: monthSales.length,
          revenue: monthSales.reduce((sum, s) => sum + Number(s.salePrice || 0), 0),
        });
      }
    } else if (period === 'year') {
      // Group by month
      for (let i = 0; i < 12; i++) {
        const monthSales = sales.filter((s) => {
          const saleDate = new Date(s.saleDate);
          return saleDate.getMonth() === i;
        });
        const monthName = new Date(startDate.getFullYear(), i, 1)
          .toLocaleDateString('en-US', { month: 'short' });
        chartData.push({
          label: monthName,
          sales: monthSales.length,
          revenue: monthSales.reduce((sum, s) => sum + Number(s.salePrice || 0), 0),
        });
      }
    }

    return chartData;
  }
}
