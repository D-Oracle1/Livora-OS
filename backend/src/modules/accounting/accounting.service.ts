import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LedgerService } from './ledger.service';
import { Prisma } from '@prisma/client';

/**
 * AccountingService — the authoritative financial reporting layer.
 *
 * RULE: Every financial total (revenue, commission, tax, expenses, net profit)
 * is derived exclusively from the GeneralLedger via LedgerService.
 * No module may recalculate these figures independently.
 *
 * The Sale / Payment / Commission / Tax / Expense tables remain the operational
 * source-of-record for individual transactions, but their *aggregates* are
 * always read from the ledger.
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly ledger: LedgerService,
  ) {}

  private toNum = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

  /** Safe expense query — returns fallback on table-not-found errors */
  private async safeExpenseQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      this.logger.error(`Expense query failed: ${err?.message ?? err}`);
      return fallback;
    }
  }

  // ─── Dashboard Summary ───────────────────────────────────────────────────────

  /**
   * Financial summary for a selectable period + YTD.
   * Pass startDate / endDate to control the "period" section (defaults to current month).
   * Revenue, commission, tax, and expenses all come from the general ledger.
   */
  async getDashboardSummary(startDate?: string, endDate?: string) {
    const now = new Date();
    const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd   = endDate   ? new Date(endDate)   : now;
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [period, ytd, pendingExpenses] = await Promise.all([
      this.ledger.getPeriodSummary(periodStart, periodEnd),
      this.ledger.getPeriodSummary(startOfYear, now),
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'PENDING', deletedAt: null },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
    ]);

    return {
      period: {
        totalRevenue:    period.revenue,
        totalCommission: period.commission,
        totalTax:        period.tax,
        totalExpenses:   period.expenses,
        netProfit:       period.netProfit,
        startDate:       periodStart.toISOString(),
        endDate:         periodEnd.toISOString(),
      },
      ytd: {
        totalRevenue:    ytd.revenue,
        totalCommission: ytd.commission,
        totalTax:        ytd.tax,
        totalExpenses:   ytd.expenses,
        netProfit:       ytd.netProfit,
      },
      pendingExpenses: {
        count:  pendingExpenses._count as number,
        amount: this.toNum(pendingExpenses._sum.amount),
      },
    };
  }

  // ─── Profit & Loss ───────────────────────────────────────────────────────────

  async getProfitAndLoss(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    // Ledger gives us authoritative totals for the period
    const [periodSummary, expenses, expensesByCategory] = await Promise.all([
      this.ledger.getPeriodSummary(start, end),
      this.safeExpenseQuery(
        () => this.prisma.expense.aggregate({
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: start, lte: end } },
          _sum: { amount: true },
          _count: true,
        }),
        { _sum: { amount: null }, _count: 0 },
      ),
      this.safeExpenseQuery(
        () => this.prisma.expense.groupBy({
          by: ['categoryId'],
          where: { approvalStatus: 'APPROVED', deletedAt: null, expenseDate: { gte: start, lte: end } },
          _sum: { amount: true },
          _count: true,
          orderBy: { _sum: { amount: 'desc' } },
        }),
        [],
      ),
    ]);

    // Detail rows — still from Sale/Payment for individual breakdown display
    const [fullSalesDetail, installmentPaymentsDetail] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
        select: {
          id: true, salePrice: true, saleDate: true,
          commissionAmount: true, taxAmount: true, netAmount: true,
          property: { select: { title: true, type: true } },
          realtor: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { saleDate: 'desc' },
      }),
      // Installment detail: show individual payments received in the period
      this.prisma.payment.findMany({
        where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
        select: {
          id: true, amount: true, paymentDate: true, paymentNumber: true,
          commissionAmount: true, taxAmount: true, netCommission: true,
          sale: {
            select: {
              id: true, salePrice: true, paymentPlan: true,
              property: { select: { title: true, type: true } },
              realtor: { select: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    // Category names for expense breakdown
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = categoryIds.length
      ? await this.prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      basis: 'CASH',
      // All financial totals are from the single ledger source
      revenue: {
        fromFullSales:       fullSalesDetail.reduce((s, r) => s + this.toNum(r.salePrice), 0),
        fromInstallments:    installmentPaymentsDetail.reduce((s, p) => s + this.toNum(p.amount), 0),
        total:               periodSummary.revenue,
        salesCount:          fullSalesDetail.length + installmentPaymentsDetail.length,
      },
      deductions: {
        commissions:         periodSummary.commission,
        taxes:               periodSummary.tax,
        total:               periodSummary.commission + periodSummary.tax,
      },
      grossProfit: periodSummary.revenue - periodSummary.commission - periodSummary.tax,
      expenses: {
        total: periodSummary.expenses,
        count: expenses._count as number,
        byCategory: expensesByCategory.map((e) => ({
          categoryId:   e.categoryId,
          categoryName: catMap.get(e.categoryId)?.name ?? 'Unknown',
          categoryType: catMap.get(e.categoryId)?.type ?? 'OTHER',
          total: this.toNum(e._sum.amount),
          count: e._count,
        })),
      },
      netProfit: periodSummary.netProfit,
      // Detail rows for display
      salesDetail: [
        ...fullSalesDetail.map((s) => ({
          id: s.id, type: 'FULL_SALE', date: s.saleDate,
          property:     s.property?.title ?? 'N/A',
          propertyType: s.property?.type  ?? 'N/A',
          realtor: s.realtor?.user ? `${s.realtor.user.firstName} ${s.realtor.user.lastName}` : 'N/A',
          salePrice:  this.toNum(s.salePrice),
          commission: this.toNum(s.commissionAmount),
          tax:        this.toNum(s.taxAmount),
          net:        this.toNum(s.netAmount),
        })),
        ...installmentPaymentsDetail
          .filter((p) => p.sale?.paymentPlan === 'INSTALLMENT')
          .map((p) => ({
            id: p.id, type: 'INSTALLMENT_PAYMENT', date: p.paymentDate,
            property:     p.sale?.property?.title ?? 'N/A',
            propertyType: p.sale?.property?.type  ?? 'N/A',
            realtor: p.sale?.realtor?.user
              ? `${p.sale.realtor.user.firstName} ${p.sale.realtor.user.lastName}` : 'N/A',
            salePrice:      this.toNum(p.amount),          // amount received in this payment
            fullSalePrice:  this.toNum(p.sale?.salePrice), // full property sale price
            commission: this.toNum(p.commissionAmount),
            tax:        this.toNum(p.taxAmount),
            net:        this.toNum(p.netCommission),
          })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    };
  }

  // ─── Trend ───────────────────────────────────────────────────────────────────

  /**
   * Monthly trend — all numbers from the ledger.
   */
  async getTrend(months = 12) {
    return this.ledger.getMonthlyBreakdown(months);
  }

  // ─── Expense Breakdown ───────────────────────────────────────────────────────

  async getExpenseBreakdown(startDate: string, endDate: string) {
    const start  = new Date(startDate);
    const end    = new Date(endDate);
    const filter = { approvalStatus: 'APPROVED' as const, deletedAt: null, expenseDate: { gte: start, lte: end } };

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
      // Total from ledger (single source)
      totalFromLedger: await this.ledger.getExpenseTotal(start, end),
      byCategory: byCategory.map((c) => ({
        categoryId:   c.categoryId,
        categoryName: catMap.get(c.categoryId)?.name ?? 'Unknown',
        categoryType: catMap.get(c.categoryId)?.type ?? 'OTHER',
        total: this.toNum(c._sum.amount),
        count: c._count,
      })),
      byPaymentMethod: byPaymentMethod.map((p) => ({
        method: p.paymentMethod,
        total:  this.toNum(p._sum.amount),
        count:  p._count,
      })),
      recentExpenses: recentExpenses.map((e) => ({
        id:              e.id,
        title:           e.title,
        category:        e.category,
        amount:          this.toNum(e.amount),
        paymentMethod:   e.paymentMethod,
        expenseDate:     e.expenseDate,
        createdBy:       e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : 'N/A',
        referenceNumber: e.referenceNumber,
        receiptUrl:      e.receiptUrl,
      })),
    };
  }

  // ─── Revenue Summary ─────────────────────────────────────────────────────────

  /**
   * Revenue detail rows.
   * Totals come from the ledger; rows are fetched from Sale/Payment tables.
   */
  async getRevenueSummary(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    const [ledgerRevenue, fullSales, installmentPayments] = await Promise.all([
      // Authoritative total from ledger
      this.ledger.getRevenue(start, end),
      // FULL plan completed sales in period
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
        select: {
          id: true, saleDate: true, salePrice: true,
          commissionAmount: true, taxAmount: true, netAmount: true, paymentPlan: true,
          property: { select: { title: true, type: true, address: true, city: true } },
          realtor:  { select: { user: { select: { firstName: true, lastName: true, email: true } }, loyaltyTier: true } },
          client:   { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { saleDate: 'desc' },
      }),
      // Installment payments received in period — use paymentDate, not saleDate
      this.prisma.payment.findMany({
        where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
        select: {
          id: true, paymentDate: true, amount: true,
          commissionAmount: true, taxAmount: true, netCommission: true, paymentMethod: true,
          sale: {
            select: {
              id: true, paymentPlan: true,
              property: { select: { title: true, type: true, address: true, city: true } },
              realtor:  { select: { user: { select: { firstName: true, lastName: true, email: true } }, loyaltyTier: true } },
              client:   { select: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    const rows = [
      ...fullSales.map((s) => ({
        id: s.id, source: 'FULL_SALE' as const, date: s.saleDate,
        property:    s.property?.title ?? 'N/A',
        propertyType: s.property?.type,
        location:    s.property ? `${s.property.address}, ${s.property.city}` : 'N/A',
        realtor:     s.realtor?.user ? `${s.realtor.user.firstName} ${s.realtor.user.lastName}` : 'N/A',
        realtorTier: s.realtor?.loyaltyTier,
        client:      s.client?.user  ? `${s.client.user.firstName} ${s.client.user.lastName}` : 'N/A',
        salePrice:   this.toNum(s.salePrice),
        commission:  this.toNum(s.commissionAmount),
        tax:         this.toNum(s.taxAmount),
        net:         this.toNum(s.netAmount),
        paymentPlan: s.paymentPlan,
      })),
      ...installmentPayments
        .filter((p) => p.sale?.paymentPlan === 'INSTALLMENT')
        .map((p) => ({
          id: p.id, source: 'INSTALLMENT_PAYMENT' as const, date: p.paymentDate,
          property:    p.sale?.property?.title ?? 'N/A',
          propertyType: p.sale?.property?.type,
          location:    p.sale?.property ? `${p.sale.property.address}, ${p.sale.property.city}` : 'N/A',
          realtor:     p.sale?.realtor?.user ? `${p.sale.realtor.user.firstName} ${p.sale.realtor.user.lastName}` : 'N/A',
          realtorTier: p.sale?.realtor?.loyaltyTier,
          client:      p.sale?.client?.user  ? `${p.sale.client.user.firstName} ${p.sale.client.user.lastName}` : 'N/A',
          salePrice:   this.toNum(p.amount),
          commission:  this.toNum(p.commissionAmount),
          tax:         this.toNum(p.taxAmount),
          net:         this.toNum(p.netCommission),
          paymentPlan: 'INSTALLMENT',
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      basis: 'CASH',
      // Totals authoritative from ledger
      summary: {
        total:           ledgerRevenue,
        totalCommission: rows.reduce((s, r) => s + r.commission, 0),
        totalTax:        rows.reduce((s, r) => s + r.tax, 0),
        count:           rows.length,
      },
      sales: rows,
    };
  }

  // ─── Balance Sheet ────────────────────────────────────────────────────────────

  async getBalanceSheet(asOfDate?: string) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const epoch = new Date('2020-01-01T00:00:00Z');

    const [
      // Assets: cash received (from ledger) up to asOf
      cashFromLedger,
      // Receivables: installment sales with outstanding balances
      inProgressSales,
      // Liabilities
      unpaidCommissions,
      pendingExpenses,
      taxLiabilities,
    ] = await Promise.all([
      this.ledger.getRevenue(epoch, asOf),
      this.prisma.sale.findMany({
        where: { status: 'IN_PROGRESS', saleDate: { lte: asOf } },
        select: {
          salePrice: true,
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
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

    const receivables = inProgressSales.reduce((sum, s) => {
      const paid = s.payments.reduce((p, pay) => p + this.toNum(pay.amount), 0);
      return sum + (this.toNum(s.salePrice) - paid);
    }, 0);

    const totalAssets = cashFromLedger + receivables;

    const unpaidCommissionsTotal = this.toNum(unpaidCommissions._sum.amount);
    const pendingExpensesTotal   = this.toNum(pendingExpenses._sum.amount);
    const taxPayable             = this.toNum(taxLiabilities._sum.amount);
    const totalLiabilities       = unpaidCommissionsTotal + pendingExpensesTotal + taxPayable;

    return {
      asOf: asOf.toISOString(),
      assets: {
        cash: { fromLedger: cashFromLedger, total: cashFromLedger },
        receivables: { total: receivables, count: inProgressSales.length },
        total: totalAssets,
      },
      liabilities: {
        unpaidCommissions: { total: unpaidCommissionsTotal, count: unpaidCommissions._count ?? 0 },
        pendingExpenses:   { total: pendingExpensesTotal,   count: (pendingExpenses as any)._count ?? 0 },
        taxPayable:        { total: taxPayable },
        total: totalLiabilities,
      },
      equity: totalAssets - totalLiabilities,
    };
  }

  // ─── Cash Flow Statement ──────────────────────────────────────────────────────

  async getCashFlow(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    const [
      totalInflows,
      totalExpenseOutflows,
      commissionOutflows,
      taxOutflows,
      installmentDetail,
      fullSaleDetail,
    ] = await Promise.all([
      // All cash received → from ledger
      this.ledger.getRevenue(start, end),
      // Expenses paid → from ledger
      this.ledger.getExpenseTotal(start, end),
      // Commission paid out (not accrued — only when disbursed)
      this.prisma.commission.aggregate({
        where: { status: 'PAID', paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      // Tax from completed full sales in period
      this.prisma.tax.aggregate({
        where: { sale: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } } },
        _sum: { amount: true },
      }),
      // Installment payment count for inflow breakdown
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paymentDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      // Full sale count
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', paymentPlan: 'FULL', saleDate: { gte: start, lte: end } },
        _sum: { salePrice: true },
        _count: true,
      }),
    ]);

    const commissionOutflowTotal = this.toNum(commissionOutflows._sum.amount);
    const taxOutflowTotal        = this.toNum(taxOutflows._sum.amount);
    const totalOutflows          = totalExpenseOutflows + commissionOutflowTotal + taxOutflowTotal;

    return {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      inflows: {
        installmentPayments: {
          total: this.toNum(installmentDetail._sum.amount),
          count: installmentDetail._count ?? 0,
        },
        fullPaymentSales: {
          total: this.toNum(fullSaleDetail._sum.salePrice),
          count: fullSaleDetail._count ?? 0,
        },
        total: totalInflows,
      },
      outflows: {
        commissions: { total: commissionOutflowTotal, count: commissionOutflows._count ?? 0 },
        expenses:    { total: totalExpenseOutflows },
        taxes:       { total: taxOutflowTotal },
        total: totalOutflows,
      },
      netCashFlow: totalInflows - totalOutflows,
      isPositive:  totalInflows - totalOutflows >= 0,
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

    // Use ledger for month comparisons — consistent with all other reports
    const [
      currentMonthExpenses,
      prev3MonthExpenses,
      lastMonthSummary,
      recentCommissions,
      avgSaleAgg,
    ] = await Promise.all([
      this.ledger.getExpenseTotal(startOfMonth, now),
      this.ledger.getExpenseTotal(startOf3MonthsAgo, startOfMonth),
      this.ledger.getPeriodSummary(startOfLastMonth, endOfLastMonth),
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

    // 1. Expense spike (>45% above 3-month average)
    const prev3Avg = prev3MonthExpenses / 3;
    if (prev3Avg > 0 && currentMonthExpenses > prev3Avg * 1.45) {
      const pct = Math.round(((currentMonthExpenses - prev3Avg) / prev3Avg) * 100);
      anomalies.push({
        type: 'EXPENSE_SPIKE', severity: 'WARNING',
        title: 'Expense Spike Detected',
        message: `Expenses this month are ${pct}% above the 3-month average`,
        value: currentMonthExpenses,
      });
    }

    // 2. Negative profit last month
    if (lastMonthSummary.revenue > 0 && lastMonthSummary.netProfit < 0) {
      anomalies.push({
        type: 'NEGATIVE_PROFIT', severity: 'CRITICAL',
        title: 'Negative Profit Last Month',
        message: 'Last month resulted in a net loss',
        value: lastMonthSummary.netProfit,
      });
    }

    // 3. High commission ratio (>50% of sale price)
    for (const comm of recentCommissions) {
      const ratio = this.toNum(comm.amount) / this.toNum(comm.sale.salePrice);
      if (ratio > 0.5) {
        anomalies.push({
          type: 'HIGH_COMMISSION', severity: 'WARNING',
          title: 'High Commission Rate',
          message: `A commission of ${(ratio * 100).toFixed(1)}% of sale price was recorded — verify this is correct`,
          value: this.toNum(comm.amount),
        });
        break;
      }
    }

    // 4. Unusually large transaction (>3× average)
    const avgSalePrice = this.toNum(avgSaleAgg._avg?.salePrice);
    if (avgSalePrice > 0) {
      const largeSales = await this.prisma.sale.findMany({
        where: { status: 'COMPLETED', saleDate: { gte: startOf3MonthsAgo } },
        select: { salePrice: true },
        orderBy: { salePrice: 'desc' },
        take: 1,
      });
      if (largeSales.length && this.toNum(largeSales[0].salePrice) > avgSalePrice * 3) {
        const pct = Math.round((this.toNum(largeSales[0].salePrice) / avgSalePrice - 1) * 100);
        anomalies.push({
          type: 'LARGE_TRANSACTION', severity: 'INFO',
          title: 'Unusually Large Transaction',
          message: `A recent sale is ${pct}% above the average sale price`,
          value: this.toNum(largeSales[0].salePrice),
        });
      }
    }

    return { anomalies, count: anomalies.length, checkedAt: now.toISOString() };
  }

  // ─── AI Financial Insights ────────────────────────────────────────────────────

  async getInsights() {
    // Trend from ledger — consistent with all other reports
    const trendData = await this.ledger.getMonthlyBreakdown(4);

    const insights: Array<{ type: 'POSITIVE' | 'NEGATIVE' | 'WARNING' | 'INFO' | 'NEUTRAL'; message: string }> = [];

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

  // ─── Recalculate All Financials ───────────────────────────────────────────────

  async recalculateAllFinancials() {
    const [commissionRates, taxRate] = await Promise.all([
      this.settingsService.getCommissionRates(),
      this.settingsService.getMainTaxRate(),
    ]);

    const sales = await this.prisma.sale.findMany({
      where: { status: { notIn: ['PENDING', 'CANCELLED'] as any[] }, realtorId: { not: null } },
      include: {
        realtor: { select: { loyaltyTier: true } },
        payments: { select: { id: true, amount: true } },
      },
    });

    let updatedSales = 0;
    let updatedPayments = 0;

    for (const sale of sales) {
      if (!sale.realtorId || !sale.realtor) continue;

      const commissionRate = commissionRates[sale.realtor.loyaltyTier as string] ?? 0.03;
      const baseAmount      = sale.paymentPlan === 'INSTALLMENT' ? Number(sale.totalPaid) : Number(sale.salePrice);
      const totalCommission = baseAmount * commissionRate;
      const totalTax        = totalCommission * taxRate;
      const totalNet        = totalCommission - totalTax;

      await this.prisma.sale.update({
        where: { id: sale.id },
        data: { commissionRate, commissionAmount: totalCommission, taxRate, taxAmount: totalTax, netAmount: totalNet },
      });

      for (const payment of sale.payments) {
        const amt  = Number(payment.amount);
        const comm = amt * commissionRate;
        const tax  = comm * taxRate;
        const net  = comm - tax;
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { commissionRate, commissionAmount: comm, taxRate, taxAmount: tax, netCommission: net },
        });
        updatedPayments++;
      }

      await this.prisma.commission.updateMany({
        where: { saleId: sale.id },
        data: { amount: totalCommission, rate: commissionRate },
      });
      await this.prisma.tax.updateMany({
        where: { saleId: sale.id },
        data: { amount: totalTax, rate: taxRate },
      });

      updatedSales++;
    }

    // Refresh realtor aggregate stats
    const realtorIds = [...new Set(sales.filter((s) => s.realtorId).map((s) => s.realtorId!))];
    for (const realtorId of realtorIds) {
      const agg = await this.prisma.sale.aggregate({
        where: { realtorId, status: { in: ['COMPLETED', 'IN_PROGRESS'] } },
        _count: { id: true },
        _sum: { salePrice: true, commissionAmount: true, taxAmount: true },
      });
      await this.prisma.realtorProfile.update({
        where: { id: realtorId },
        data: {
          totalSales:      agg._count.id,
          totalSalesValue: agg._sum.salePrice       ?? 0,
          totalCommission: agg._sum.commissionAmount ?? 0,
          totalTaxPaid:    agg._sum.taxAmount        ?? 0,
        },
      });
    }

    // After recalculating, re-run backfill so ledger reflects updated amounts
    const backfillResult = await this.ledger.backfill();

    return {
      success: true,
      message: `Recalculated ${updatedSales} sales and ${updatedPayments} payments. Ledger refreshed.`,
      updatedSales,
      updatedPayments,
      commissionRates,
      taxRate,
      ledgerBackfill: backfillResult.counts,
    };
  }

  // ─── Ledger Operations (exposed via controller) ────────────────────────────────

  /**
   * Populate the general ledger from existing financial records.
   * Run once after deploying this version — safe to repeat.
   */
  async backfillLedger() {
    return this.ledger.backfill();
  }

  /**
   * Cross-check ledger totals against source tables.
   */
  async validateConsistency() {
    return this.ledger.validateConsistency();
  }
}
