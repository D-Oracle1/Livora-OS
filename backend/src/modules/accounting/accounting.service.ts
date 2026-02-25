import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard Summary ───────────────────────────────────────────────────────

  async getDashboardSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      revMTD, commMTD, taxMTD, expMTD,
      revYTD, commYTD, taxYTD, expYTD,
      pendingExpenses,
    ] = await Promise.all([
      // Revenue MTD
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', saleDate: { gte: startOfMonth } },
        _sum: { salePrice: true },
      }),
      // Commission MTD
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: startOfMonth } } },
        _sum: { amount: true },
      }),
      // Tax MTD
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: startOfMonth } } },
        _sum: { amount: true },
      }),
      // Expenses MTD
      this.prisma.expense.aggregate({
        where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      // Revenue YTD
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', saleDate: { gte: startOfYear } },
        _sum: { salePrice: true },
      }),
      // Commission YTD
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: startOfYear } } },
        _sum: { amount: true },
      }),
      // Tax YTD
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: startOfYear } } },
        _sum: { amount: true },
      }),
      // Expenses YTD
      this.prisma.expense.aggregate({
        where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      // Pending expenses (not yet approved)
      this.prisma.expense.aggregate({
        where: { approvalStatus: 'PENDING', deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const toNum = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

    const totalRevenueMTD = toNum(revMTD._sum.salePrice);
    const totalDeductionsMTD = toNum(commMTD._sum.amount) + toNum(taxMTD._sum.amount);
    const totalExpensesMTD = toNum(expMTD._sum.amount);
    const netProfitMTD = totalRevenueMTD - totalDeductionsMTD - totalExpensesMTD;

    const totalRevenueYTD = toNum(revYTD._sum.salePrice);
    const totalDeductionsYTD = toNum(commYTD._sum.amount) + toNum(taxYTD._sum.amount);
    const totalExpensesYTD = toNum(expYTD._sum.amount);
    const netProfitYTD = totalRevenueYTD - totalDeductionsYTD - totalExpensesYTD;

    return {
      mtd: {
        totalRevenue: totalRevenueMTD,
        totalCommission: toNum(commMTD._sum.amount),
        totalTax: toNum(taxMTD._sum.amount),
        totalExpenses: totalExpensesMTD,
        netProfit: netProfitMTD,
      },
      ytd: {
        totalRevenue: totalRevenueYTD,
        totalCommission: toNum(commYTD._sum.amount),
        totalTax: toNum(taxYTD._sum.amount),
        totalExpenses: totalExpensesYTD,
        netProfit: netProfitYTD,
      },
      pendingExpenses: {
        count: pendingExpenses._count,
        amount: toNum(pendingExpenses._sum.amount),
      },
    };
  }

  // ─── Profit & Loss ───────────────────────────────────────────────────────────

  async getProfitAndLoss(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const saleDateFilter = { gte: start, lte: end };

    const [revenue, commissions, taxes, expenses, expensesByCategory, salesBreakdown] =
      await Promise.all([
        // Total revenue from completed sales
        this.prisma.sale.aggregate({
          where: { status: 'COMPLETED', saleDate: saleDateFilter },
          _sum: { salePrice: true },
          _count: true,
        }),
        // Total commissions
        this.prisma.commission.aggregate({
          where: { sale: { status: 'COMPLETED', saleDate: saleDateFilter } },
          _sum: { amount: true },
          _count: true,
        }),
        // Total taxes
        this.prisma.tax.aggregate({
          where: { sale: { status: 'COMPLETED', saleDate: saleDateFilter } },
          _sum: { amount: true },
        }),
        // Total approved expenses
        this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: saleDateFilter },
          _sum: { amount: true },
          _count: true,
        }),
        // Expenses grouped by category
        this.prisma.expense.groupBy({
          by: ['categoryId'],
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: saleDateFilter },
          _sum: { amount: true },
          _count: true,
          orderBy: { _sum: { amount: 'desc' } },
        }),
        // Monthly sales breakdown
        this.prisma.sale.findMany({
          where: { status: 'COMPLETED', saleDate: saleDateFilter },
          select: {
            id: true,
            salePrice: true,
            saleDate: true,
            commissionAmount: true,
            taxAmount: true,
            netAmount: true,
            property: { select: { title: true, type: true } },
            realtor: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { saleDate: 'desc' },
        }),
      ]);

    // Enrich category breakdown
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = categoryIds.length
      ? await this.prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const toNum = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

    const totalRevenue = toNum(revenue._sum.salePrice);
    const totalCommission = toNum(commissions._sum.amount);
    const totalTax = toNum(taxes._sum.amount);
    const totalExpenses = toNum(expenses._sum.amount);
    const grossProfit = totalRevenue - totalCommission - totalTax;
    const netProfit = grossProfit - totalExpenses;

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      revenue: {
        propertySales: totalRevenue,
        salesCount: revenue._count,
        total: totalRevenue,
      },
      deductions: {
        commissions: totalCommission,
        commissionsCount: commissions._count,
        taxes: totalTax,
        total: totalCommission + totalTax,
      },
      grossProfit,
      expenses: {
        total: totalExpenses,
        count: expenses._count,
        byCategory: expensesByCategory.map((e) => ({
          categoryId: e.categoryId,
          categoryName: catMap.get(e.categoryId)?.name ?? 'Unknown',
          categoryType: catMap.get(e.categoryId)?.type ?? 'OTHER',
          total: toNum(e._sum.amount),
          count: e._count,
        })),
      },
      netProfit,
      salesDetail: salesBreakdown.map((s) => ({
        id: s.id,
        date: s.saleDate,
        property: s.property?.title ?? 'N/A',
        propertyType: s.property?.type ?? 'N/A',
        realtor: s.realtor?.user
          ? `${s.realtor.user.firstName} ${s.realtor.user.lastName}`
          : 'N/A',
        salePrice: toNum(s.salePrice),
        commission: toNum(s.commissionAmount),
        tax: toNum(s.taxAmount),
        net: toNum(s.netAmount),
      })),
    };
  }

  // ─── Trend ───────────────────────────────────────────────────────────────────

  async getTrend(months = 12) {
    const now = new Date();
    const result: Array<{
      month: string;
      year: number;
      monthNum: number;
      revenue: number;
      commission: number;
      tax: number;
      expenses: number;
      netProfit: number;
    }> = [];

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const [rev, comm, tax, exp] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { status: 'COMPLETED', saleDate: { gte: start, lte: end } },
          _sum: { salePrice: true },
        }),
        this.prisma.commission.aggregate({
          where: { sale: { status: 'COMPLETED', saleDate: { gte: start, lte: end } } },
          _sum: { amount: true },
        }),
        this.prisma.tax.aggregate({
          where: { sale: { status: 'COMPLETED', saleDate: { gte: start, lte: end } } },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            approvalStatus: 'APPROVED',
            deletedAt: null,
            expenseDate: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
      ]);

      const revenue = Number(rev._sum.salePrice ?? 0);
      const commission = Number(comm._sum.amount ?? 0);
      const taxes = Number(tax._sum.amount ?? 0);
      const expenses = Number(exp._sum.amount ?? 0);

      result.push({
        month: MONTH_NAMES[d.getMonth()],
        year: d.getFullYear(),
        monthNum: d.getMonth() + 1,
        revenue,
        commission,
        tax: taxes,
        expenses,
        netProfit: revenue - commission - taxes - expenses,
      });
    }

    return result;
  }

  // ─── Expense Breakdown ───────────────────────────────────────────────────────

  async getExpenseBreakdown(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const filter = {
      approvalStatus: 'APPROVED' as const,
      deletedAt: null,
      expenseDate: { gte: start, lte: end },
    };

    const [byCategory, byPaymentMethod, recentExpenses] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: filter,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      this.prisma.expense.groupBy({
        by: ['paymentMethod'],
        where: filter,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      this.prisma.expense.findMany({
        where: filter,
        orderBy: { expenseDate: 'desc' },
        take: 50,
        include: {
          category: { select: { id: true, name: true, type: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const categoryIds = byCategory.map((c) => c.categoryId);
    const categories = categoryIds.length
      ? await this.prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return {
      byCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        categoryName: catMap.get(c.categoryId)?.name ?? 'Unknown',
        categoryType: catMap.get(c.categoryId)?.type ?? 'OTHER',
        total: Number(c._sum.amount ?? 0),
        count: c._count,
      })),
      byPaymentMethod: byPaymentMethod.map((p) => ({
        method: p.paymentMethod,
        total: Number(p._sum.amount ?? 0),
        count: p._count,
      })),
      recentExpenses: recentExpenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        paymentMethod: e.paymentMethod,
        expenseDate: e.expenseDate,
        createdBy: e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : 'N/A',
        referenceNumber: e.referenceNumber,
        receiptUrl: e.receiptUrl,
      })),
    };
  }

  // ─── Revenue Summary ─────────────────────────────────────────────────────────

  async getRevenueSummary(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const sales = await this.prisma.sale.findMany({
      where: { status: 'COMPLETED', saleDate: { gte: start, lte: end } },
      select: {
        id: true,
        saleDate: true,
        salePrice: true,
        commissionAmount: true,
        taxAmount: true,
        netAmount: true,
        paymentPlan: true,
        property: { select: { title: true, type: true, address: true, city: true } },
        realtor: {
          select: {
            user: { select: { firstName: true, lastName: true, email: true } },
            loyaltyTier: true,
          },
        },
        client: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    const total = sales.reduce((acc, s) => acc + Number(s.salePrice), 0);
    const totalCommission = sales.reduce((acc, s) => acc + Number(s.commissionAmount), 0);
    const totalTax = sales.reduce((acc, s) => acc + Number(s.taxAmount), 0);

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      summary: { total, totalCommission, totalTax, count: sales.length },
      sales: sales.map((s) => ({
        id: s.id,
        date: s.saleDate,
        property: s.property?.title ?? 'N/A',
        propertyType: s.property?.type,
        location: s.property ? `${s.property.address}, ${s.property.city}` : 'N/A',
        realtor: s.realtor?.user
          ? `${s.realtor.user.firstName} ${s.realtor.user.lastName}`
          : 'N/A',
        realtorTier: s.realtor?.loyaltyTier,
        client: s.client?.user
          ? `${s.client.user.firstName} ${s.client.user.lastName}`
          : 'N/A',
        salePrice: Number(s.salePrice),
        commission: Number(s.commissionAmount),
        tax: Number(s.taxAmount),
        net: Number(s.netAmount),
        paymentPlan: s.paymentPlan,
      })),
    };
  }
}
