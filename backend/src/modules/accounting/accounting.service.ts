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

  /**
   * CASH-BASIS REVENUE HELPERS
   *
   * Revenue is recognised when cash is received:
   *   - FULL payment plan  → Sale.salePrice on the saleDate the sale completed
   *   - INSTALLMENT plan   → Payment.amount on each paymentDate (never the parent Sale)
   *
   * Commission and Tax follow the same split so there is no double-counting.
   */
  private async cashRevenue(dateField: 'saleDate' | 'paymentDate', filter: any) {
    const [fullSales, payments] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: filter },
        _sum: { salePrice: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: filter },
        _sum: { amount: true, commissionAmount: true, taxAmount: true },
        _count: true,
      }),
    ]);
    return { fullSales, payments };
  }

  private async cashCommission(saleDateFilter: any, paymentDateFilter: any) {
    const [fromFullSales, fromPayments] = await Promise.all([
      // Commission on FULL plan completed sales
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: saleDateFilter } },
        _sum: { amount: true },
        _count: true,
      }),
      // Commission embedded in each installment payment
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: paymentDateFilter },
        _sum: { commissionAmount: true },
      }),
    ]);
    return { fromFullSales, fromPayments };
  }

  private async cashTax(saleDateFilter: any, paymentDateFilter: any) {
    const [fromFullSales, fromPayments] = await Promise.all([
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: saleDateFilter } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: paymentDateFilter },
        _sum: { taxAmount: true },
      }),
    ]);
    return { fromFullSales, fromPayments };
  }

  // ─── Dashboard Summary ───────────────────────────────────────────────────────

  async getDashboardSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    const toNum = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

    // Run MTD and YTD sets sequentially to respect pgBouncer pool limits
    const mtdFilter = { gte: startOfMonth };
    const ytdFilter = { gte: startOfYear };

    const [
      // MTD
      mtdFullSales, mtdPayments, mtdExpenses,
      // YTD
      ytdFullSales, ytdPayments, ytdExpenses,
      // Pending expenses (no date filter)
      pendingExpenses,
    ] = await Promise.all([
      // MTD: FULL plan sales completed this month
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: mtdFilter },
        _sum: { salePrice: true },
      }),
      // MTD: installment payments received this month
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: mtdFilter },
        _sum: { amount: true, commissionAmount: true, taxAmount: true },
      }),
      // MTD: approved expenses this month
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: mtdFilter },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      // YTD: FULL plan sales completed this year
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: ytdFilter },
        _sum: { salePrice: true },
      }),
      // YTD: installment payments received this year
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: ytdFilter },
        _sum: { amount: true, commissionAmount: true, taxAmount: true },
      }),
      // YTD: approved expenses this year
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: ytdFilter },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      // Pending expenses (unapproved)
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'PENDING', deletedAt: null },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
    ]);

    // MTD commission: FULL-sale commissions + installment payment commissions
    const [mtdFullComm, ytdFullComm] = await Promise.all([
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: mtdFilter } },
        _sum: { amount: true },
      }),
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: ytdFilter } },
        _sum: { amount: true },
      }),
    ]);

    // MTD tax: FULL-sale taxes + installment payment taxes
    const [mtdFullTax, ytdFullTax] = await Promise.all([
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: mtdFilter } },
        _sum: { amount: true },
      }),
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: ytdFilter } },
        _sum: { amount: true },
      }),
    ]);

    // ── MTD calculations ──────────────────────────────────────────────────────
    const totalRevenueMTD   = toNum(mtdFullSales._sum.salePrice) + toNum(mtdPayments._sum.amount);
    const totalCommissionMTD = toNum(mtdFullComm._sum.amount)    + toNum(mtdPayments._sum.commissionAmount);
    const totalTaxMTD        = toNum(mtdFullTax._sum.amount)     + toNum(mtdPayments._sum.taxAmount);
    const totalExpensesMTD   = toNum(mtdExpenses._sum.amount);
    const netProfitMTD       = totalRevenueMTD - totalCommissionMTD - totalTaxMTD - totalExpensesMTD;

    // ── YTD calculations ──────────────────────────────────────────────────────
    const totalRevenueYTD   = toNum(ytdFullSales._sum.salePrice) + toNum(ytdPayments._sum.amount);
    const totalCommissionYTD = toNum(ytdFullComm._sum.amount)    + toNum(ytdPayments._sum.commissionAmount);
    const totalTaxYTD        = toNum(ytdFullTax._sum.amount)     + toNum(ytdPayments._sum.taxAmount);
    const totalExpensesYTD   = toNum(ytdExpenses._sum.amount);
    const netProfitYTD       = totalRevenueYTD - totalCommissionYTD - totalTaxYTD - totalExpensesYTD;

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
    const end   = new Date(endDate);

    const saleDateFilter    = { gte: start, lte: end };
    const paymentDateFilter = { gte: start, lte: end };

    const toNum = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

    const [
      fullSalesAgg,
      installmentPaymentsAgg,
      fullSalesCommission,
      fullSalesTax,
      expenses,
      expensesByCategory,
      // Detail: FULL plan completed sales in period
      fullSalesDetail,
      // Detail: installment payments in period with sale/property info
      installmentPaymentsDetail,
    ] = await Promise.all([
      // Revenue: FULL plan sales
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: saleDateFilter },
        _sum: { salePrice: true },
        _count: true,
      }),
      // Revenue: installment payments received
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: paymentDateFilter },
        _sum: { amount: true, commissionAmount: true, taxAmount: true },
        _count: true,
      }),
      // Commission: FULL plan sales
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: saleDateFilter } },
        _sum: { amount: true },
        _count: true,
      }),
      // Tax: FULL plan sales
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: saleDateFilter } },
        _sum: { amount: true },
      }),
      // Expenses
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: saleDateFilter },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      // Expenses by category
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
      // FULL sales detail
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: saleDateFilter },
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
      // Installment payments detail
      this.prisma.payment.findMany({
        where: { status: 'COMPLETED', paymentDate: paymentDateFilter },
        select: {
          id: true,
          amount: true,
          commissionAmount: true,
          taxAmount: true,
          paymentDate: true,
          sale: {
            select: {
              id: true,
              property: { select: { title: true, type: true } },
              realtor: { select: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    // Enrich expense categories
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories  = categoryIds.length
      ? await this.prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    // ── Totals ────────────────────────────────────────────────────────────────
    const fullRevenue     = toNum(fullSalesAgg._sum.salePrice);
    const installRevenue  = toNum(installmentPaymentsAgg._sum.amount);
    const totalRevenue    = fullRevenue + installRevenue;

    const fullComm        = toNum(fullSalesCommission._sum.amount);
    const installComm     = toNum(installmentPaymentsAgg._sum.commissionAmount);
    const totalCommission = fullComm + installComm;

    const fullTax         = toNum(fullSalesTax._sum.amount);
    const installTax      = toNum(installmentPaymentsAgg._sum.taxAmount);
    const totalTax        = fullTax + installTax;

    const totalExpenses   = toNum(expenses._sum.amount);
    const grossProfit     = totalRevenue - totalCommission - totalTax;
    const netProfit       = grossProfit - totalExpenses;

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      basis: 'CASH',
      revenue: {
        fullPaymentSales: fullRevenue,
        fullSalesCount: fullSalesAgg._count,
        installmentPayments: installRevenue,
        installmentPaymentsCount: installmentPaymentsAgg._count,
        total: totalRevenue,
        // legacy field retained for P&L display
        propertySales: totalRevenue,
        salesCount: fullSalesAgg._count + installmentPaymentsAgg._count,
      },
      deductions: {
        commissions: totalCommission,
        commissionsCount: fullSalesCommission._count + installmentPaymentsAgg._count,
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
      salesDetail: [
        // FULL sales
        ...fullSalesDetail.map((s) => ({
          id: s.id,
          type: 'FULL_SALE',
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
        // Installment payments
        ...installmentPaymentsDetail.map((p) => ({
          id: p.id,
          type: 'INSTALLMENT_PAYMENT',
          date: p.paymentDate,
          property: p.sale?.property?.title ?? 'N/A',
          propertyType: p.sale?.property?.type ?? 'N/A',
          realtor: p.sale?.realtor?.user
            ? `${p.sale.realtor.user.firstName} ${p.sale.realtor.user.lastName}`
            : 'N/A',
          salePrice: toNum(p.amount),
          commission: toNum(p.commissionAmount),
          tax: toNum(p.taxAmount),
          net: toNum(p.amount) - toNum(p.commissionAmount) - toNum(p.taxAmount),
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
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
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      return { d, start, end };
    });

    const results: any[] = [];

    for (const { d, start, end } of monthRanges) {
      // Cash-basis: FULL plan sales by saleDate + installment payments by paymentDate
      const [fullSales, installPayments, fullComm, fullTax, exp] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
          _sum: { salePrice: true },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
          _sum: { amount: true, commissionAmount: true, taxAmount: true },
        }),
        this.prisma.commission.aggregate({
          where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } } },
          _sum: { amount: true },
        }),
        this.prisma.tax.aggregate({
          where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } } },
          _sum: { amount: true },
        }),
        this.safeExpenseQuery(
          () => this.prisma.expense.aggregate({
            where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          { _sum: { amount: null } },
        ),
      ]);

      const revenue    = Number(fullSales._sum.salePrice ?? 0) + Number(installPayments._sum.amount ?? 0);
      const commission = Number(fullComm._sum.amount ?? 0)    + Number(installPayments._sum.commissionAmount ?? 0);
      const taxes      = Number(fullTax._sum.amount ?? 0)     + Number(installPayments._sum.taxAmount ?? 0);
      const expenses   = Number(exp._sum.amount ?? 0);

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
    const start  = new Date(startDate);
    const end    = new Date(endDate);
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
    const categories  = categoryIds.length
      ? await this.prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return {
      byCategory: byCategory.map((c) => ({
        categoryId:   c.categoryId,
        categoryName: catMap.get(c.categoryId)?.name ?? 'Unknown',
        categoryType: catMap.get(c.categoryId)?.type ?? 'OTHER',
        total: Number(c._sum.amount ?? 0),
        count: c._count,
      })),
      byPaymentMethod: byPaymentMethod.map((p) => ({
        method: p.paymentMethod,
        total:  Number(p._sum.amount ?? 0),
        count:  p._count,
      })),
      recentExpenses: recentExpenses.map((e) => ({
        id:              e.id,
        title:           e.title,
        category:        e.category,
        amount:          Number(e.amount),
        paymentMethod:   e.paymentMethod,
        expenseDate:     e.expenseDate,
        createdBy:       e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : 'N/A',
        referenceNumber: e.referenceNumber,
        receiptUrl:      e.receiptUrl,
      })),
    };
  }

  // ─── Revenue Summary ─────────────────────────────────────────────────────────

  async getRevenueSummary(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    const [fullSales, installmentPayments] = await Promise.all([
      // FULL plan completed sales
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
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
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { saleDate: 'desc' },
      }),
      // Installment payments received
      this.prisma.payment.findMany({
        where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
        select: {
          id: true,
          paymentDate: true,
          amount: true,
          commissionAmount: true,
          taxAmount: true,
          netCommission: true,
          paymentMethod: true,
          sale: {
            select: {
              id: true,
              paymentPlan: true,
              property: { select: { title: true, type: true, address: true, city: true } },
              realtor: {
                select: {
                  user: { select: { firstName: true, lastName: true, email: true } },
                  loyaltyTier: true,
                },
              },
              client: {
                select: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    const toNum = (v: any) => Number(v ?? 0);

    const rows = [
      ...fullSales.map((s) => ({
        id: s.id,
        source: 'FULL_SALE' as const,
        date: s.saleDate,
        property: s.property?.title ?? 'N/A',
        propertyType: s.property?.type,
        location: s.property ? `${s.property.address}, ${s.property.city}` : 'N/A',
        realtor: s.realtor?.user
          ? `${s.realtor.user.firstName} ${s.realtor.user.lastName}` : 'N/A',
        realtorTier: s.realtor?.loyaltyTier,
        client: s.client?.user
          ? `${s.client.user.firstName} ${s.client.user.lastName}` : 'N/A',
        salePrice:  toNum(s.salePrice),
        commission: toNum(s.commissionAmount),
        tax:        toNum(s.taxAmount),
        net:        toNum(s.netAmount),
        paymentPlan: s.paymentPlan,
      })),
      ...installmentPayments.map((p) => ({
        id: p.id,
        source: 'INSTALLMENT_PAYMENT' as const,
        date: p.paymentDate,
        property: p.sale?.property?.title ?? 'N/A',
        propertyType: p.sale?.property?.type,
        location: p.sale?.property
          ? `${p.sale.property.address}, ${p.sale.property.city}` : 'N/A',
        realtor: p.sale?.realtor?.user
          ? `${p.sale.realtor.user.firstName} ${p.sale.realtor.user.lastName}` : 'N/A',
        realtorTier: p.sale?.realtor?.loyaltyTier,
        client: p.sale?.client?.user
          ? `${p.sale.client.user.firstName} ${p.sale.client.user.lastName}` : 'N/A',
        salePrice:   toNum(p.amount),
        commission:  toNum(p.commissionAmount),
        tax:         toNum(p.taxAmount),
        net:         toNum(p.amount) - toNum(p.commissionAmount) - toNum(p.taxAmount),
        paymentPlan: 'INSTALLMENT',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total           = rows.reduce((s, r) => s + r.salePrice, 0);
    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const totalTax        = rows.reduce((s, r) => s + r.tax, 0);

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      basis: 'CASH',
      summary: { total, totalCommission, totalTax, count: rows.length },
      sales: rows,
    };
  }

  // ─── Balance Sheet ────────────────────────────────────────────────────────────

  async getBalanceSheet(asOfDate?: string) {
    const asOf  = asOfDate ? new Date(asOfDate) : new Date();
    const toNum = (v: any) => Number(v ?? 0);

    const [
      completedFullSales,
      completedPayments,
      inProgressSalesDetail,
      unpaidCommissions,
      pendingExpensesAgg,
      taxLiabilities,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { lte: asOf } },
        _sum: { salePrice: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: { lte: asOf } },
        _sum: { amount: true },
        _count: true,
      }),
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
      this.prisma.commission.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'PENDING', deletedAt: null, expenseDate: { lte: asOf } },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', saleDate: { lte: asOf } } },
        _sum: { amount: true },
      }),
    ]);

    const receivables = inProgressSalesDetail.reduce((sum, s) => {
      const paid = s.payments.reduce((p, pay) => p + toNum(pay.amount), 0);
      return sum + (toNum(s.salePrice) - paid);
    }, 0);

    const cashFromFullSales     = toNum(completedFullSales._sum.salePrice);
    const cashFromInstallments  = toNum(completedPayments._sum.amount);
    const totalCash             = cashFromFullSales + cashFromInstallments;
    const totalAssets           = totalCash + receivables;

    const unpaidCommissionsTotal = toNum(unpaidCommissions._sum.amount);
    const pendingExpensesTotal   = toNum(pendingExpensesAgg._sum.amount);
    const taxPayable             = toNum(taxLiabilities._sum.amount);
    const totalLiabilities       = unpaidCommissionsTotal + pendingExpensesTotal + taxPayable;

    const equity = totalAssets - totalLiabilities;

    return {
      asOf: asOf.toISOString(),
      assets: {
        cash: {
          fromFullSales:            cashFromFullSales,
          fullSalesCount:           toNum(completedFullSales._count),
          fromInstallments:         cashFromInstallments,
          installmentPaymentsCount: toNum(completedPayments._count),
          total:                    totalCash,
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
        taxPayable: { total: taxPayable },
        total: totalLiabilities,
      },
      equity,
    };
  }

  // ─── Cash Flow Statement ──────────────────────────────────────────────────────

  async getCashFlow(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    const toNum = (v: any) => Number(v ?? 0);

    const [
      installmentPayments,
      fullSales,
      commissionsPaid,
      approvedExpenses,
      taxesFromSales,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
        _sum: { salePrice: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { status: 'PAID', paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: start, lte: end } },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } } },
        _sum: { amount: true },
      }),
    ]);

    const installmentInflows = toNum(installmentPayments._sum.amount);
    const fullSaleInflows    = toNum(fullSales._sum.salePrice);
    const totalInflows       = installmentInflows + fullSaleInflows;

    const commissionOutflows = toNum(commissionsPaid._sum.amount);
    const expenseOutflows    = toNum(approvedExpenses._sum.amount);
    const taxOutflows        = toNum(taxesFromSales._sum.amount);
    const totalOutflows      = commissionOutflows + expenseOutflows + taxOutflows;

    const netCashFlow = totalInflows - totalOutflows;

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      inflows: {
        installmentPayments: { total: installmentInflows, count: toNum(installmentPayments._count) },
        fullPaymentSales:    { total: fullSaleInflows,    count: toNum(fullSales._count) },
        total: totalInflows,
      },
      outflows: {
        commissions: { total: commissionOutflows, count: toNum(commissionsPaid._count) },
        expenses:    { total: expenseOutflows,    count: toNum(approvedExpenses._count) },
        taxes:       { total: taxOutflows },
        total: totalOutflows,
      },
      netCashFlow,
      isPositive: netCashFlow >= 0,
    };
  }

  // ─── Anomaly Detection ────────────────────────────────────────────────────────

  async getAnomalies() {
    const now = new Date();
    const startOfMonth      = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startOfLastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

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
      lastMonthFullSales,
      lastMonthInstallPayments,
      lastMonthCommFullAgg,
      lastMonthTaxFullAgg,
      lastMonthExpAgg,
      recentCommissions,
      avgSaleAgg,
    ] = await Promise.all([
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: {
            approvalStatus: 'APPROVED', deletedAt: null,
            expenseDate: { gte: startOf3MonthsAgo, lt: startOfMonth },
          },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { salePrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amount: true, commissionAmount: true, taxAmount: true },
      }),
      this.prisma.commission.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: startOfLastMonth, lte: endOfLastMonth } } },
        _sum: { amount: true },
      }),
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: startOfLastMonth, lte: endOfLastMonth } } },
        _sum: { amount: true },
      }),
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
          _sum: { amount: true },
        }),
        { _sum: { amount: null } },
      ),
      this.prisma.commission.findMany({
        where: { sale: { status: 'COMPLETED' } },
        select: { id: true, amount: true, rate: true, sale: { select: { salePrice: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED' },
        _avg: { salePrice: true },
      }),
    ]);

    // 1. Expense spike
    const currentExp = toNum(currentMonthExp._sum.amount);
    const prev3Avg   = toNum(prev3MonthsExp._sum.amount) / 3;
    if (prev3Avg > 0 && currentExp > prev3Avg * 1.45) {
      const pct = Math.round(((currentExp - prev3Avg) / prev3Avg) * 100);
      anomalies.push({
        type: 'EXPENSE_SPIKE', severity: 'WARNING',
        title: 'Expense Spike Detected',
        message: `Expenses this month are ${pct}% above the 3-month average`,
        value: currentExp,
      });
    }

    // 2. Negative profit last month (cash basis)
    const lastRev    = toNum(lastMonthFullSales._sum.salePrice) + toNum(lastMonthInstallPayments._sum.amount);
    const lastComm   = toNum(lastMonthCommFullAgg._sum.amount)  + toNum(lastMonthInstallPayments._sum.commissionAmount);
    const lastTax    = toNum(lastMonthTaxFullAgg._sum.amount)   + toNum(lastMonthInstallPayments._sum.taxAmount);
    const lastProfit = lastRev - lastComm - lastTax - toNum(lastMonthExpAgg._sum.amount);
    if (lastRev > 0 && lastProfit < 0) {
      anomalies.push({
        type: 'NEGATIVE_PROFIT', severity: 'CRITICAL',
        title: 'Negative Profit Last Month',
        message: 'Last month resulted in a net loss',
        value: lastProfit,
      });
    }

    // 3. High commission ratio (>50% of sale price)
    for (const comm of recentCommissions) {
      const ratio = toNum(comm.amount) / toNum(comm.sale.salePrice);
      if (ratio > 0.5) {
        anomalies.push({
          type: 'HIGH_COMMISSION', severity: 'WARNING',
          title: 'High Commission Rate',
          message: `A commission of ${(ratio * 100).toFixed(1)}% of sale price was recorded — verify this is correct`,
          value: toNum(comm.amount),
        });
        break;
      }
    }

    // 4. Unusually large transaction (>3× average sale price)
    const avgSalePrice = toNum(avgSaleAgg._avg?.salePrice);
    if (avgSalePrice > 0) {
      const largeSales = await this.prisma.sale.findMany({
        where: { status: 'COMPLETED', saleDate: { gte: startOf3MonthsAgo } },
        select: { salePrice: true },
        orderBy: { salePrice: 'desc' },
        take: 1,
      });
      if (largeSales.length && toNum(largeSales[0].salePrice) > avgSalePrice * 3) {
        const pct = Math.round((toNum(largeSales[0].salePrice) / avgSalePrice - 1) * 100);
        anomalies.push({
          type: 'LARGE_TRANSACTION', severity: 'INFO',
          title: 'Unusually Large Transaction',
          message: `A recent sale is ${pct}% above the average sale price`,
          value: toNum(largeSales[0].salePrice),
        });
      }
    }

    return { anomalies, count: anomalies.length, checkedAt: new Date().toISOString() };
  }

  // ─── AI Financial Insights ────────────────────────────────────────────────────

  async getInsights() {
    const trendData = await this.getTrend(4);

    const insights: Array<{
      type: 'POSITIVE' | 'NEGATIVE' | 'WARNING' | 'INFO' | 'NEUTRAL';
      message: string;
    }> = [];

    if (trendData.length >= 2) {
      const current  = trendData[trendData.length - 1];
      const previous = trendData[trendData.length - 2];

      if (previous.revenue > 0) {
        const revChange = ((current.revenue - previous.revenue) / previous.revenue) * 100;
        if (Math.abs(revChange) >= 5) {
          insights.push({
            type: revChange > 0 ? 'POSITIVE' : 'NEGATIVE',
            message: `Cash receipts ${revChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(revChange).toFixed(0)}% compared to last month`,
          });
        }
      }

      if (current.revenue > 0) {
        const commRatio = (current.commission / current.revenue) * 100;
        insights.push({
          type: commRatio > 35 ? 'WARNING' : 'NEUTRAL',
          message: `Commission payouts represent ${commRatio.toFixed(0)}% of cash revenue this month`,
        });
      }

      if (current.netProfit > previous.netProfit && previous.netProfit >= 0) {
        insights.push({ type: 'POSITIVE', message: `Net profit improved in ${current.month} ${current.year}` });
      } else if (current.netProfit < previous.netProfit && current.netProfit < 0) {
        insights.push({ type: 'NEGATIVE', message: `Net profit declined in ${current.month} ${current.year}` });
      }
    }

    if (trendData.length >= 3) {
      const last3 = trendData.slice(-3);
      const expIncreasing = last3.every((d, i) => i === 0 || d.expenses >= last3[i - 1].expenses);
      const expDecreasing = last3.every((d, i) => i === 0 || d.expenses <= last3[i - 1].expenses);
      if (expIncreasing && last3[2].expenses > 0) {
        insights.push({ type: 'WARNING', message: 'Expenses are trending upward over the past 3 months' });
      } else if (expDecreasing && last3[0].expenses > 0) {
        insights.push({ type: 'POSITIVE', message: 'Expenses are trending downward — strong cost control' });
      }
    }

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
      insights.push({ type: 'INFO', message: `${topType[0]} properties generate the highest revenue overall` });
    }

    return { insights, generatedAt: new Date().toISOString() };
  }
}
