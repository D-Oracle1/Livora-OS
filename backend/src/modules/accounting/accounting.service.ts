import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Run a Prisma expense query safely; returns fallback on table-not-found errors */
  private async safeExpenseQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      this.logger.error(`Expense query failed: ${err?.message ?? err}`);
      return fallback;
    }
  }

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
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfMonth } },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
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
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfYear } },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      // Pending expenses (not yet approved)
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'PENDING', deletedAt: null },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
    ]);

    const toNum = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

    const totalRevenueMTD = toNum(revMTD._sum.salePrice);
    const totalCommissionMTD = toNum(commMTD._sum.amount);
    const totalTaxMTD = toNum(taxMTD._sum.amount);
    const totalDeductionsMTD = totalCommissionMTD + totalTaxMTD;
    const totalExpensesMTD = toNum(expMTD._sum.amount);
    const netProfitMTD = totalRevenueMTD - totalDeductionsMTD - totalExpensesMTD;

    const totalRevenueYTD = toNum(revYTD._sum.salePrice);
    const totalCommissionYTD = toNum(commYTD._sum.amount);
    const totalTaxYTD = toNum(taxYTD._sum.amount);
    const totalDeductionsYTD = totalCommissionYTD + totalTaxYTD;
    const totalExpensesYTD = toNum(expYTD._sum.amount);
    const netProfitYTD = totalRevenueYTD - totalDeductionsYTD - totalExpensesYTD;

    return {
      mtd: {
        totalRevenue: totalRevenueMTD,
        totalCommission: totalCommissionMTD,
        totalTax: totalTaxMTD,
        totalExpenses: totalExpensesMTD,
        netProfit: netProfitMTD,
      },
      ytd: {
        totalRevenue: totalRevenueYTD,
        totalCommission: totalCommissionYTD,
        totalTax: totalTaxYTD,
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
        this.safeExpenseQuery(
          () => this.prisma.expense.aggregate({
            where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: saleDateFilter },
            _sum: { amount: true },
            _count: true,
          }),
          { _sum: { amount: null }, _count: 0 },
        ),
        // Expenses grouped by category
        this.safeExpenseQuery(
          () => this.prisma.expense.groupBy({
            by: ['categoryId'],
            where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: saleDateFilter },
            _sum: { amount: true },
            _count: true,
            orderBy: { _sum: { amount: 'desc' } },
          }),
          [],
        ),
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
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const monthRanges = Array.from({ length: months }, (_, idx) => {
      const i = months - 1 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      return { d, start, end };
    });

    // Process months sequentially to avoid saturating the pgBouncer connection pool.
    // Each iteration opens at most 4 parallel connections (one per query type).
    const results: any[] = [];

    for (const { d, start, end } of monthRanges) {
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
        this.safeExpenseQuery(
          () => this.prisma.expense.aggregate({
            where: {
              approvalStatus: 'APPROVED',
              deletedAt: null,
              expenseDate: { gte: start, lte: end },
            },
            _sum: { amount: true },
          }),
          { _sum: { amount: null } },
        ),
      ]);

      const revenue = Number(rev._sum.salePrice ?? 0);
      const commission = Number(comm._sum.amount ?? 0);
      const taxes = Number(tax._sum.amount ?? 0);
      const expenses = Number(exp._sum.amount ?? 0);

      results.push({
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

    return results;
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

  // ─── Balance Sheet ────────────────────────────────────────────────────────────

  async getBalanceSheet(asOfDate?: string) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const toNum = (v: any) => Number(v ?? 0);

    const [
      completedFullSales,
      completedPayments,
      inProgressSalesDetail,
      unpaidCommissions,
      pendingExpensesAgg,
      taxLiabilities,
    ] = await Promise.all([
      // Cash from FULL payment completed sales
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { lte: asOf } },
        _sum: { salePrice: true },
        _count: true,
      }),
      // Cash received from installment payments
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: { lte: asOf } },
        _sum: { amount: true },
        _count: true,
      }),
      // IN_PROGRESS installment sales — compute outstanding receivables
      this.prisma.sale.findMany({
        where: { status: 'IN_PROGRESS', saleDate: { lte: asOf } },
        select: {
          salePrice: true,
          payments: {
            where: { status: 'COMPLETED' },
            select: { amount: true },
          },
        },
      }),
      // Unpaid (PENDING) commissions
      this.prisma.commission.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      // Unapproved (PENDING) expenses
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'PENDING', deletedAt: null, expenseDate: { lte: asOf } },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      // Tax collected from completed sales (payable to government)
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { lte: asOf } } },
        _sum: { amount: true },
      }),
    ]);

    // Receivables = sum of outstanding balance on each in-progress sale
    const receivables = inProgressSalesDetail.reduce((sum, s) => {
      const paid = s.payments.reduce((p, pay) => p + toNum(pay.amount), 0);
      return sum + (toNum(s.salePrice) - paid);
    }, 0);

    const cashFromFullSales = toNum(completedFullSales._sum.salePrice);
    const cashFromInstallments = toNum(completedPayments._sum.amount);
    const totalCash = cashFromFullSales + cashFromInstallments;
    const totalAssets = totalCash + receivables;

    const unpaidCommissionsTotal = toNum(unpaidCommissions._sum.amount);
    const pendingExpensesTotal = toNum(pendingExpensesAgg._sum.amount);
    const taxPayable = toNum(taxLiabilities._sum.amount);
    const totalLiabilities = unpaidCommissionsTotal + pendingExpensesTotal + taxPayable;

    const equity = totalAssets - totalLiabilities;

    return {
      asOf: asOf.toISOString(),
      assets: {
        cash: {
          fromFullSales: cashFromFullSales,
          fullSalesCount: toNum(completedFullSales._count),
          fromInstallments: cashFromInstallments,
          installmentPaymentsCount: toNum(completedPayments._count),
          total: totalCash,
        },
        receivables: {
          total: receivables,
          count: inProgressSalesDetail.length,
        },
        total: totalAssets,
      },
      liabilities: {
        unpaidCommissions: {
          total: unpaidCommissionsTotal,
          count: toNum(unpaidCommissions._count),
        },
        pendingExpenses: {
          total: pendingExpensesTotal,
          count: toNum(pendingExpensesAgg._count),
        },
        taxPayable: {
          total: taxPayable,
        },
        total: totalLiabilities,
      },
      equity,
    };
  }

  // ─── Cash Flow Statement ──────────────────────────────────────────────────────

  async getCashFlow(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const toNum = (v: any) => Number(v ?? 0);

    const [
      installmentPayments,
      fullSales,
      commissionsPaid,
      approvedExpenses,
      taxesFromSales,
    ] = await Promise.all([
      // Inflow: installment payments received in period
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      // Inflow: full-payment sales completed in period
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
        _sum: { salePrice: true },
        _count: true,
      }),
      // Outflow: commissions actually paid out in period
      this.prisma.commission.aggregate({
        where: { status: 'PAID', paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      // Outflow: approved expenses in period
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: start, lte: end } },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      // Outflow: taxes on completed sales in period
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: start, lte: end } } },
        _sum: { amount: true },
      }),
    ]);

    const installmentInflows = toNum(installmentPayments._sum.amount);
    const fullSaleInflows = toNum(fullSales._sum.salePrice);
    const totalInflows = installmentInflows + fullSaleInflows;

    const commissionOutflows = toNum(commissionsPaid._sum.amount);
    const expenseOutflows = toNum(approvedExpenses._sum.amount);
    const taxOutflows = toNum(taxesFromSales._sum.amount);
    const totalOutflows = commissionOutflows + expenseOutflows + taxOutflows;

    const netCashFlow = totalInflows - totalOutflows;

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      inflows: {
        installmentPayments: {
          total: installmentInflows,
          count: toNum(installmentPayments._count),
        },
        fullPaymentSales: {
          total: fullSaleInflows,
          count: toNum(fullSales._count),
        },
        total: totalInflows,
      },
      outflows: {
        commissions: {
          total: commissionOutflows,
          count: toNum(commissionsPaid._count),
        },
        expenses: {
          total: expenseOutflows,
          count: toNum(approvedExpenses._count),
        },
        taxes: {
          total: taxOutflows,
        },
        total: totalOutflows,
      },
      netCashFlow,
      isPositive: netCashFlow >= 0,
    };
  }

  // ─── Anomaly Detection ────────────────────────────────────────────────────────

  async getAnomalies() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const anomalies: Array<{
      type: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      title: string;
      message: string;
      value?: number;
    }> = [];

    const toNum = (v: any) => Number(v ?? 0);

    const [
      currentMonthExp,
      prev3MonthsExp,
      lastMonthRevAgg,
      lastMonthCommAgg,
      lastMonthTaxAgg,
      lastMonthExpAgg,
      recentCommissions,
      avgSaleAgg,
    ] = await Promise.all([
      // Current month expenses
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      // Past 3 months expenses (for average)
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: {
            approvalStatus: 'APPROVED',
            deletedAt: null,
            expenseDate: { gte: startOf3MonthsAgo, lt: startOfMonth },
          },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      // Last month revenue
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', saleDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { salePrice: true },
      }),
      // Last month commissions
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: startOfLastMonth, lte: endOfLastMonth } } },
        _sum: { amount: true },
      }),
      // Last month taxes
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { gte: startOfLastMonth, lte: endOfLastMonth } } },
        _sum: { amount: true },
      }),
      // Last month approved expenses
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: {
            approvalStatus: 'APPROVED',
            deletedAt: null,
            expenseDate: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      // Recent commissions — check for unusually high rates (>50% of sale price)
      this.prisma.commission.findMany({
        where: { sale: { status: 'COMPLETED' } },
        select: { id: true, amount: true, rate: true, sale: { select: { salePrice: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Average completed sale price (all time) for large-payment detection
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED' },
        _avg: { salePrice: true },
        _count: true,
      }),
    ]);

    // 1. Expense spike: current month > 145% of 3-month average
    const currentExp = toNum(currentMonthExp._sum.amount);
    const prev3Avg = toNum(prev3MonthsExp._sum.amount) / 3;
    if (prev3Avg > 0 && currentExp > prev3Avg * 1.45) {
      const pct = Math.round(((currentExp - prev3Avg) / prev3Avg) * 100);
      anomalies.push({
        type: 'EXPENSE_SPIKE',
        severity: 'WARNING',
        title: 'Expense Spike Detected',
        message: `Expenses this month are ${pct}% above the 3-month average`,
        value: currentExp,
      });
    }

    // 2. Negative profit last month
    const lastRev = toNum(lastMonthRevAgg._sum.salePrice);
    const lastProfit =
      lastRev -
      toNum(lastMonthCommAgg._sum.amount) -
      toNum(lastMonthTaxAgg._sum.amount) -
      toNum(lastMonthExpAgg._sum.amount);
    if (lastRev > 0 && lastProfit < 0) {
      anomalies.push({
        type: 'NEGATIVE_PROFIT',
        severity: 'CRITICAL',
        title: 'Negative Profit Last Month',
        message: `Last month resulted in a net loss`,
        value: lastProfit,
      });
    }

    // 3. Commission overpayment: commission amount > 50% of sale price
    for (const comm of recentCommissions) {
      const ratio = toNum(comm.amount) / toNum(comm.sale.salePrice);
      if (ratio > 0.5) {
        anomalies.push({
          type: 'HIGH_COMMISSION',
          severity: 'WARNING',
          title: 'High Commission Rate',
          message: `A commission of ${(ratio * 100).toFixed(1)}% of sale price was recorded — verify this is correct`,
          value: toNum(comm.amount),
        });
        break; // Only report first occurrence
      }
    }

    // 4. Unusually large single payment (> 3x average sale price)
    const avgSalePrice = toNum(avgSaleAgg._avg?.salePrice);
    if (avgSalePrice > 0) {
      const largeSales = await this.prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          saleDate: { gte: startOf3MonthsAgo },
        },
        select: { salePrice: true, saleDate: true, property: { select: { title: true } } },
        orderBy: { salePrice: 'desc' },
        take: 3,
      });
      for (const sale of largeSales) {
        if (toNum(sale.salePrice) > avgSalePrice * 3) {
          anomalies.push({
            type: 'LARGE_TRANSACTION',
            severity: 'INFO',
            title: 'Unusually Large Transaction',
            message: `A sale of ${(toNum(sale.salePrice) / 1_000_000).toFixed(2)}M was recorded — ${toNum(sale.salePrice) / avgSalePrice > 1 ? `${((toNum(sale.salePrice) / avgSalePrice - 1) * 100).toFixed(0)}% above average` : ''}`,
            value: toNum(sale.salePrice),
          });
          break;
        }
      }
    }

    return {
      anomalies,
      count: anomalies.length,
      checkedAt: new Date().toISOString(),
    };
  }

  // ─── AI Financial Insights ────────────────────────────────────────────────────

  async getInsights() {
    const trendData = await this.getTrend(4); // Last 4 months

    const insights: Array<{
      type: 'POSITIVE' | 'NEGATIVE' | 'WARNING' | 'INFO' | 'NEUTRAL';
      message: string;
    }> = [];

    if (trendData.length >= 2) {
      const current = trendData[trendData.length - 1];
      const previous = trendData[trendData.length - 2];

      // 1. Month-over-month revenue change
      if (previous.revenue > 0) {
        const revChange = ((current.revenue - previous.revenue) / previous.revenue) * 100;
        if (Math.abs(revChange) >= 5) {
          insights.push({
            type: revChange > 0 ? 'POSITIVE' : 'NEGATIVE',
            message: `Sales ${revChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(revChange).toFixed(0)}% compared to last month`,
          });
        }
      }

      // 2. Commission ratio
      if (current.revenue > 0) {
        const commRatio = (current.commission / current.revenue) * 100;
        insights.push({
          type: commRatio > 35 ? 'WARNING' : 'NEUTRAL',
          message: `Commission payouts represent ${commRatio.toFixed(0)}% of revenue this month`,
        });
      }

      // 3. Net profit direction
      if (current.netProfit > previous.netProfit && previous.netProfit >= 0) {
        insights.push({
          type: 'POSITIVE',
          message: `Net profit improved in ${current.month} ${current.year}`,
        });
      } else if (current.netProfit < previous.netProfit && current.netProfit < 0) {
        insights.push({
          type: 'NEGATIVE',
          message: `Net profit declined in ${current.month} ${current.year}`,
        });
      }
    }

    // 4. Expense trend direction (last 3 months)
    if (trendData.length >= 3) {
      const last3 = trendData.slice(-3);
      const expIncreasing = last3.every((d, i) => i === 0 || d.expenses >= last3[i - 1].expenses);
      const expDecreasing = last3.every((d, i) => i === 0 || d.expenses <= last3[i - 1].expenses);
      if (expIncreasing && last3[2].expenses > 0) {
        insights.push({
          type: 'WARNING',
          message: `Expenses are trending upward over the past 3 months`,
        });
      } else if (expDecreasing && last3[0].expenses > 0) {
        insights.push({
          type: 'POSITIVE',
          message: `Expenses are trending downward — strong cost control`,
        });
      }
    }

    // 5. Top revenue property type (all-time)
    const allSales = await this.prisma.sale.findMany({
      where: { status: 'COMPLETED' },
      select: { salePrice: true, property: { select: { type: true } } },
      take: 500,
    });
    const byType: Record<string, number> = {};
    for (const s of allSales) {
      const t = s.property?.type ?? 'Unknown';
      byType[t] = (byType[t] ?? 0) + Number(s.salePrice);
    }
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    if (topType) {
      insights.push({
        type: 'INFO',
        message: `${topType[0]} properties generate the highest revenue overall`,
      });
    }

    return {
      insights,
      generatedAt: new Date().toISOString(),
    };
  }
}
