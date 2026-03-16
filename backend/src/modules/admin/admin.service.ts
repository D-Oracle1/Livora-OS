import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { SaleStatus, PropertyStatus, LoyaltyTier } from '@prisma/client';
import { DashboardPeriod, getDateRange, groupSalesIntoChartBuckets, LedgerEntry } from '../../common/utils/date-range.util';
import { LedgerService } from '../accounting/ledger.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly ledgerService: LedgerService,
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

    const allTimeStart = new Date('2000-01-01T00:00:00Z');
    const now = new Date();

    const [
      totalRealtors,
      activeRealtors,
      totalClients,
      activeClients,
      totalStaff,
      activeStaff,
      totalProperties,
      activeListings,
      filteredSalesCount,
      // Revenue from ledger — uses actual payment dates, not saleDate (correct cash-basis)
      filteredRevenue,
      filteredCommission,
      pendingSales,
      salesForChart,
      recentSales,
      tierDistribution,
      ledgerChartEntries,
      // All-time totals for KPI overview cards
      allTimeRevenue,
      allTimeCommission,
      allTimeSalesCount,
    ] = await Promise.all([
      this.prisma.realtorProfile.count(),
      this.prisma.realtorProfile.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      this.prisma.clientProfile.count(),
      this.prisma.clientProfile.count({ where: { user: { status: 'ACTIVE' } } }),
      this.prisma.staffProfile.count(),
      this.prisma.staffProfile.count({ where: { isActive: true, user: { status: 'ACTIVE' } } }),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { isListed: true } }),
      // Count active sales for the period (by saleDate — contract dates are correct here)
      this.prisma.sale.count({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
      }),
      // LEDGER: cash received in period (uses actual payment dates — no date-attribution bug)
      this.ledgerService.getRevenue(startDate, endDate),
      // Commission from ledger — consistent with revenue
      this.ledgerService.getCommissionTotal(startDate, endDate),
      this.prisma.sale.count({ where: { status: SaleStatus.PENDING } }),
      // Chart data — sale counts by saleDate (contracts), revenue from ledger below
      this.prisma.sale.findMany({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
        select: { saleDate: true, salePrice: true, totalPaid: true, paymentPlan: true, commissionAmount: true },
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
      // Ledger entries for chart revenue (cash-basis, by payment date)
      this.prisma.generalLedger.findMany({
        where: { entryType: 'SALE_PAYMENT', entryDate: { gte: startDate, lte: endDate } },
        select: { entryDate: true, amount: true },
      }),
      // All-time revenue and commission (no date filter)
      this.ledgerService.getRevenue(allTimeStart, now),
      this.ledgerService.getCommissionTotal(allTimeStart, now),
      this.prisma.sale.count({
        where: { status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] } },
      }),
    ]);

    const chartData = groupSalesIntoChartBuckets(salesForChart, activePeriod, startDate, endDate, ledgerChartEntries as LedgerEntry[]);
    const filteredCommissionFromSales = filteredCommission;

    // Convert tier distribution to object
    const tierDistributionMap = tierDistribution.reduce((acc, item) => {
      acc[item.loyaltyTier] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const result = {
      realtors: { total: totalRealtors, active: activeRealtors },
      clients: { total: totalClients, active: activeClients },
      staff: { total: totalStaff, active: activeStaff },
      properties: { total: totalProperties, activeListings },
      sales: {
        filtered: filteredSalesCount,
        allTime: allTimeSalesCount,
        pending: pendingSales,
      },
      revenue: {
        filtered: filteredRevenue,
        allTime: allTimeRevenue,
      },
      commission: {
        filtered: filteredCommission,
        filteredFromSales: filteredCommissionFromSales,
        allTime: allTimeCommission,
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
      // LEDGER: authoritative revenue for the period (uses actual payment dates)
      totalCashRevenue,
      totalSalesCount,
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
      // LEDGER: cash received in period — correct date attribution (payment date, not sale date)
      this.ledgerService.getRevenue(startDate, endDate),
      // Sale count (contracts — by saleDate is appropriate for "how many deals were done")
      this.prisma.sale.count({
        where: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
          saleDate: dateFilter,
        },
      }),
      // Sales with property info for type/location breakdown
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
        totalRevenue: Number(s._sum.salePrice ?? 0),
        totalCommission: Number(s._sum.commissionAmount ?? 0),
      };
    });

    // Ledger revenue by time bucket — chart bars show actual cash received, not contract values
    const ledgerRevenueMap = await this.ledgerService.getRevenueByPeriod(startDate, endDate, period);

    // Process chart data based on period (sales COUNT from Sale table, revenue from ledger)
    const chartData = this.processChartData(salesForChart, period, startDate, endDate, ledgerRevenueMap);

    // Calculate property type percentages
    const totalPropertySales = salesByPropertyType.reduce((sum, pt) => sum + pt.count, 0) || 1;
    const propertyTypes = salesByPropertyType.map((pt) => ({
      type: pt.type,
      count: pt.count,
      percentage: Math.round((pt.count / totalPropertySales) * 100),
      revenue: pt.revenue,
    }));

    // Summary stats — totalRevenue from ledger (single source of truth)
    const stats = {
      totalRevenue:   totalCashRevenue,
      propertiesSold: totalSalesCount,
      newClients:     newClientsCount,
      avgSalePrice:   totalSalesCount > 0 ? totalCashRevenue / totalSalesCount : 0,
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

  /**
   * Build chart data buckets.
   * - sales COUNT comes from the Sale table (contract dates — correct for "how many deals")
   * - revenue comes from the ledger revenue map (actual cash received, correct date attribution)
   */
  private processChartData(
    sales: { saleDate: Date; salePrice: any }[],
    period: string,
    startDate: Date,
    endDate: Date,
    ledgerRevenue?: Map<string, number>,
  ) {
    const rev = (label: string) => ledgerRevenue?.get(label) ?? 0;
    const chartData: { label: string; sales: number; revenue: number }[] = [];

    if (period === 'week') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        const daySales = sales.filter((s) => new Date(s.saleDate).toDateString() === date.toDateString());
        chartData.push({ label: dayLabel, sales: daySales.length, revenue: rev(dayLabel) });
      }
    } else if (period === 'month') {
      for (let i = 0; i < 4; i++) {
        const label = `Week ${i + 1}`;
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekSales = sales.filter((s) => {
          const d = new Date(s.saleDate);
          return d >= weekStart && d <= weekEnd;
        });
        chartData.push({ label, sales: weekSales.length, revenue: rev(label) });
      }
    } else if (period === 'quarter') {
      const quarterStart = startDate.getMonth();
      for (let i = 0; i < 3; i++) {
        const monthName = new Date(startDate.getFullYear(), quarterStart + i, 1)
          .toLocaleDateString('en-US', { month: 'short' });
        const monthSales = sales.filter((s) => new Date(s.saleDate).getMonth() === quarterStart + i);
        chartData.push({ label: monthName, sales: monthSales.length, revenue: rev(monthName) });
      }
    } else if (period === 'year') {
      for (let i = 0; i < 12; i++) {
        const monthName = new Date(startDate.getFullYear(), i, 1)
          .toLocaleDateString('en-US', { month: 'short' });
        const monthSales = sales.filter((s) => new Date(s.saleDate).getMonth() === i);
        chartData.push({ label: monthName, sales: monthSales.length, revenue: rev(monthName) });
      }
    }

    return chartData;
  }
}
