import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Period/YTD financial summary — all figures from the general ledger' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate',   required: false })
  getDashboardSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?: string,
  ) {
    return this.service.getDashboardSummary(startDate, endDate);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Profit & Loss statement for a date range' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getProfitAndLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end   = endDate   || new Date().toISOString();
    return this.service.getProfitAndLoss(start, end);
  }

  @Get('trend')
  @ApiOperation({ summary: 'Monthly revenue/expense trend (from ledger)' })
  @ApiQuery({ name: 'months', required: false })
  getTrend(@Query('months') months?: string) {
    return this.service.getTrend(months ? parseInt(months, 10) : 12);
  }

  @Get('expense-breakdown')
  @ApiOperation({ summary: 'Expense analysis by category and payment method' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getExpenseBreakdown(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end   = endDate   || new Date().toISOString();
    return this.service.getExpenseBreakdown(start, end);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Cash revenue detail (payments received, not contract values)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getRevenueSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end   = endDate   || new Date().toISOString();
    return this.service.getRevenueSummary(start, end);
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Balance sheet (assets, liabilities, equity)' })
  @ApiQuery({ name: 'asOf', required: false })
  getBalanceSheet(@Query('asOf') asOf?: string) {
    return this.service.getBalanceSheet(asOf);
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Cash flow statement (inflows from sales, outflows for expenses/commissions/taxes)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end   = endDate   || new Date().toISOString();
    return this.service.getCashFlow(start, end);
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Real-time financial anomaly detection' })
  getAnomalies() {
    return this.service.getAnomalies();
  }

  @Get('insights')
  @ApiOperation({ summary: 'AI-generated financial insights' })
  getInsights() {
    return this.service.getInsights();
  }

  @Post('recalculate-financials')
  @ApiOperation({ summary: 'Retroactively recalculate commission/tax rates and refresh ledger' })
  recalculateAllFinancials() {
    return this.service.recalculateAllFinancials();
  }

  /**
   * POST /accounting/backfill-ledger
   *
   * Populate the general ledger from existing Sale, Payment, Commission,
   * Tax, and Expense records.  Run this ONCE after deploying the new engine.
   * Safe to re-run — duplicate entries are silently ignored.
   */
  @Post('backfill-ledger')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER, UserRole.SUPER_ADMIN as any)
  @ApiOperation({ summary: 'Backfill the general ledger from existing financial records (run once after deploy)' })
  backfillLedger() {
    return this.service.backfillLedger();
  }

  /**
   * GET /accounting/validate
   *
   * Cross-check the general ledger against source tables.
   * Returns pass/fail for each consistency test.
   */
  @Get('validate')
  @ApiOperation({ summary: 'Validate ledger consistency against source tables' })
  validateConsistency() {
    return this.service.validateConsistency();
  }
}
