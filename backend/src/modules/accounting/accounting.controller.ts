import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  getDashboardSummary() {
    return this.service.getDashboardSummary();
  }

  @Get('profit-loss')
  getProfitAndLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = endDate || new Date().toISOString();
    return this.service.getProfitAndLoss(start, end);
  }

  @Get('trend')
  getTrend(@Query('months') months?: string) {
    return this.service.getTrend(months ? parseInt(months, 10) : 12);
  }

  @Get('expense-breakdown')
  getExpenseBreakdown(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = endDate || new Date().toISOString();
    return this.service.getExpenseBreakdown(start, end);
  }

  @Get('revenue')
  getRevenueSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = endDate || new Date().toISOString();
    return this.service.getRevenueSummary(start, end);
  }

  @Get('balance-sheet')
  getBalanceSheet(@Query('asOf') asOf?: string) {
    return this.service.getBalanceSheet(asOf);
  }

  @Get('cash-flow')
  getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = endDate || new Date().toISOString();
    return this.service.getCashFlow(start, end);
  }

  @Get('anomalies')
  getAnomalies() {
    return this.service.getAnomalies();
  }

  @Get('insights')
  getInsights() {
    return this.service.getInsights();
  }
}
