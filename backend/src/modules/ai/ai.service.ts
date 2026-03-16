import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PropertyType, SaleStatus } from '@prisma/client';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async predictPropertyPrice(data: {
    type: PropertyType;
    city: string;
    area: number;
    bedrooms?: number;
    bathrooms?: number;
    yearBuilt?: number;
    features?: string[];
  }) {
    // Get comparable properties
    const comparables = await this.prisma.property.findMany({
      where: {
        type: data.type,
        city: { contains: data.city, mode: 'insensitive' },
        area: {
          gte: data.area * 0.8,
          lte: data.area * 1.2,
        },
      },
      select: {
        price: true,
        area: true,
        bedrooms: true,
        bathrooms: true,
        yearBuilt: true,
      },
      take: 20,
    });

    if (comparables.length === 0) {
      // Use city average
      const cityAvg = await this.prisma.property.aggregate({
        where: {
          type: data.type,
          city: { contains: data.city, mode: 'insensitive' },
        },
        _avg: { price: true },
      });

      const basePricePerSqft = (Number(cityAvg._avg.price) || 300) / 1500; // Default if no data
      return {
        predictedPrice: Math.round(basePricePerSqft * data.area),
        confidence: 0.3,
        method: 'city_average',
        comparablesCount: 0,
      };
    }

    // Calculate price per square foot
    const pricesPerSqft = comparables.map((c) => Number(c.price) / c.area);
    const avgPricePerSqft = pricesPerSqft.reduce((a, b) => a + b, 0) / pricesPerSqft.length;

    // Adjustments
    let adjustedPrice = avgPricePerSqft * data.area;

    // Bedroom adjustment (+3% per bedroom above average)
    if (data.bedrooms) {
      const avgBedrooms = comparables.reduce((sum, c) => sum + (c.bedrooms || 0), 0) / comparables.length;
      const bedroomDiff = data.bedrooms - avgBedrooms;
      adjustedPrice *= 1 + bedroomDiff * 0.03;
    }

    // Year built adjustment (+1% per decade newer)
    if (data.yearBuilt) {
      const avgYearBuilt = comparables.reduce((sum, c) => sum + (c.yearBuilt || 2000), 0) / comparables.length;
      const yearDiff = (data.yearBuilt - avgYearBuilt) / 10;
      adjustedPrice *= 1 + yearDiff * 0.01;
    }

    // Feature adjustments
    const featureValues = {
      'pool': 0.05,
      'garage': 0.03,
      'garden': 0.02,
      'smart home': 0.04,
      'renovated': 0.06,
      'waterfront': 0.15,
      'mountain view': 0.08,
    };

    if (data.features) {
      for (const feature of data.features) {
        const lowerFeature = feature.toLowerCase();
        for (const [key, value] of Object.entries(featureValues)) {
          if (lowerFeature.includes(key)) {
            adjustedPrice *= 1 + value;
          }
        }
      }
    }

    const confidence = Math.min(0.95, 0.5 + comparables.length * 0.02);

    return {
      predictedPrice: Math.round(adjustedPrice),
      priceRange: {
        low: Math.round(adjustedPrice * 0.9),
        high: Math.round(adjustedPrice * 1.1),
      },
      confidence,
      method: 'comparable_analysis',
      comparablesCount: comparables.length,
      avgPricePerSqft: Math.round(avgPricePerSqft),
    };
  }

  async getMarketAnalysis(city: string) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
    const oneYearAgo = new Date(now.setMonth(now.getMonth() - 6));

    const [
      currentListings,
      recentSales,
      avgPrice,
      priceChange,
      daysOnMarket,
    ] = await Promise.all([
      this.prisma.property.count({
        where: {
          city: { contains: city, mode: 'insensitive' },
          isListed: true,
        },
      }),
      this.prisma.sale.count({
        where: {
          property: { city: { contains: city, mode: 'insensitive' } },
          status: SaleStatus.COMPLETED,
          saleDate: { gte: sixMonthsAgo },
        },
      }),
      this.prisma.property.aggregate({
        where: { city: { contains: city, mode: 'insensitive' } },
        _avg: { price: true },
      }),
      this.calculatePriceChange(city),
      this.calculateAverageDaysOnMarket(city),
    ]);

    const supplyDemandRatio = currentListings > 0 ? recentSales / currentListings : 0;

    let marketCondition: 'buyers' | 'sellers' | 'balanced';
    if (supplyDemandRatio > 1.2) {
      marketCondition = 'sellers';
    } else if (supplyDemandRatio < 0.8) {
      marketCondition = 'buyers';
    } else {
      marketCondition = 'balanced';
    }

    return {
      city,
      currentListings,
      recentSales,
      avgPrice: avgPrice._avg.price || 0,
      priceChange,
      avgDaysOnMarket: daysOnMarket,
      supplyDemandRatio: Math.round(supplyDemandRatio * 100) / 100,
      marketCondition,
      recommendation: this.getMarketRecommendation(marketCondition, priceChange),
    };
  }

  private async calculatePriceChange(city: string) {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    const oneYearAgo = new Date(now);
    oneYearAgo.setMonth(now.getMonth() - 12);

    const [recent, past] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          property: { city: { contains: city, mode: 'insensitive' } },
          status: SaleStatus.COMPLETED,
          saleDate: { gte: sixMonthsAgo },
        },
        _avg: { salePrice: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          property: { city: { contains: city, mode: 'insensitive' } },
          status: SaleStatus.COMPLETED,
          saleDate: { gte: oneYearAgo, lt: sixMonthsAgo },
        },
        _avg: { salePrice: true },
      }),
    ]);

    if (!past._avg.salePrice || !recent._avg.salePrice) {
      return 0;
    }

    return Math.round(
      ((Number(recent._avg.salePrice) - Number(past._avg.salePrice)) /
        Number(past._avg.salePrice)) *
        100 *
        100,
    ) / 100;
  }

  private async calculateAverageDaysOnMarket(city: string): Promise<number> {
    // Simulated - in real app would track listing date to sale date
    return 45; // Default average
  }

  private getMarketRecommendation(condition: string, priceChange: number): string {
    if (condition === 'sellers' && priceChange > 0) {
      return 'Strong seller\'s market. Good time to list properties. Prices are trending upward.';
    } else if (condition === 'sellers') {
      return 'Seller\'s market with stable prices. Properties are selling quickly.';
    } else if (condition === 'buyers' && priceChange < 0) {
      return 'Buyer\'s market with declining prices. Good opportunity for investors.';
    } else if (condition === 'buyers') {
      return 'Buyer\'s market with stable prices. Negotiate for better deals.';
    } else {
      return 'Balanced market. Fair conditions for both buyers and sellers.';
    }
  }

  async predictRealtorPerformance(realtorId: string) {
    const realtor = await this.prisma.realtorProfile.findUnique({
      where: { id: realtorId },
      include: {
        sales: {
          where: { status: SaleStatus.COMPLETED },
          orderBy: { saleDate: 'desc' },
          take: 24,
        },
      },
    });

    if (!realtor) {
      throw new Error('Realtor not found');
    }

    // Calculate trend
    const salesByMonth = new Map<string, number>();
    realtor.sales.forEach((sale) => {
      const monthKey = `${sale.saleDate.getFullYear()}-${String(sale.saleDate.getMonth() + 1).padStart(2, '0')}`;
      salesByMonth.set(monthKey, (salesByMonth.get(monthKey) || 0) + 1);
    });

    const recentMonths = Array.from(salesByMonth.entries()).slice(0, 6);
    const olderMonths = Array.from(salesByMonth.entries()).slice(6, 12);

    const recentAvg = recentMonths.reduce((sum, [, count]) => sum + count, 0) / (recentMonths.length || 1);
    const olderAvg = olderMonths.reduce((sum, [, count]) => sum + count, 0) / (olderMonths.length || 1);

    const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    // Predict next quarter
    const predictedSalesNextQuarter = Math.round(recentAvg * 3 * (1 + trend / 100));
    const avgSaleValue = realtor.totalSales > 0
      ? Number(realtor.totalSalesValue) / realtor.totalSales
      : 0;
    const predictedRevenue = predictedSalesNextQuarter * avgSaleValue;

    return {
      realtorId,
      currentTier: realtor.loyaltyTier,
      currentRank: realtor.currentRank,
      performanceTrend: Math.round(trend * 100) / 100,
      trendDirection: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
      predictions: {
        nextQuarterSales: predictedSalesNextQuarter,
        nextQuarterRevenue: Math.round(predictedRevenue),
        confidenceLevel: realtor.sales.length >= 12 ? 'high' : realtor.sales.length >= 6 ? 'medium' : 'low',
      },
      recommendations: this.getPerformanceRecommendations(trend, realtor.loyaltyTier),
    };
  }

  /**
   * Get comparable properties by city and type (used by AI market insights).
   */
  async getComparables(city: string, propertyType: string): Promise<{ price: number }[]> {
    const properties = await this.prisma.property.findMany({
      where: {
        city: { contains: city, mode: 'insensitive' },
        type: propertyType as PropertyType,
      },
      select: { price: true },
      take: 50,
    });
    return properties.map((p) => ({ price: Number(p.price) }));
  }

  /**
   * Build monthly sales data array for trend analysis.
   * Returns months in descending order (most recent first).
   */
  async buildMonthlySalesData(
    lookbackMonths = 6,
  ): Promise<Array<{ month: string; count: number; value: number }>> {
    const now = new Date();
    const results: Array<{ month: string; count: number; value: number }> = [];

    for (let i = 0; i < lookbackMonths; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const agg = await this.prisma.sale.aggregate({
        where: {
          status: SaleStatus.COMPLETED,
          saleDate: { gte: start, lte: end },
        },
        _count: { id: true },
        _sum: { salePrice: true },
      });

      results.push({
        month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        count: agg._count.id,
        value: Number(agg._sum.salePrice ?? 0),
      });
    }

    return results;
  }

  private getPerformanceRecommendations(trend: number, tier: string): string[] {
    const recommendations = [];

    if (trend < 0) {
      recommendations.push('Consider focusing on client relationship building');
      recommendations.push('Review and update listing strategies');
      recommendations.push('Increase marketing efforts');
    }

    if (tier === 'BRONZE') {
      recommendations.push('Target 5 more sales to reach Silver tier');
      recommendations.push('Focus on building your client network');
    } else if (tier === 'SILVER') {
      recommendations.push('15 more sales to reach Gold tier with 4% commission');
      recommendations.push('Consider specializing in a property type');
    } else if (tier === 'GOLD') {
      recommendations.push('Platinum tier within reach - 50 more sales needed');
      recommendations.push('Mentor junior realtors to boost team performance');
    }

    if (trend > 10) {
      recommendations.push('Excellent momentum! Consider expanding to new areas');
    }

    return recommendations;
  }

  async getInvestmentScore(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        priceHistory: { orderBy: { createdAt: 'desc' } },
        sales: { orderBy: { saleDate: 'desc' }, take: 5 },
      },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    // Calculate appreciation rate
    const appreciationRate = property.appreciationPercentage || 0;

    // Market demand score (based on listing activity)
    const cityListings = await this.prisma.property.count({
      where: { city: property.city, isListed: true },
    });
    const citySales = await this.prisma.sale.count({
      where: {
        property: { city: property.city },
        status: SaleStatus.COMPLETED,
        saleDate: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
    });
    const demandScore = cityListings > 0 ? Math.min(100, (citySales / cityListings) * 100) : 50;

    // Price competitiveness
    const avgPrice = await this.prisma.property.aggregate({
      where: { city: property.city, type: property.type },
      _avg: { price: true },
    });
    const priceRatio = avgPrice._avg.price
      ? Number(property.price) / Number(avgPrice._avg.price)
      : 1;
    const priceScore = priceRatio <= 0.9 ? 90 : priceRatio <= 1.1 ? 70 : 50;

    // Calculate overall score
    const overallScore = Math.round(
      appreciationRate * 0.3 +
        demandScore * 0.4 +
        priceScore * 0.3,
    );

    return {
      propertyId,
      overallScore: Math.min(100, Math.max(0, overallScore)),
      breakdown: {
        appreciationRate: Math.round(appreciationRate * 100) / 100,
        demandScore: Math.round(demandScore),
        priceCompetitiveness: Math.round(priceScore),
      },
      recommendation: overallScore > 70
        ? 'Strong investment potential'
        : overallScore > 50
          ? 'Moderate investment potential'
          : 'Consider other options',
      riskLevel: overallScore > 70 ? 'low' : overallScore > 50 ? 'medium' : 'high',
    };
  }
}
