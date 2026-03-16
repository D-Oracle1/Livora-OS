import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExportService } from './export.service';
import { SaleStatus, PayrollStatus } from '@prisma/client';

@ApiTags('Export')
@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * GET /api/v1/export/sales?format=csv&startDate=2024-01-01&endDate=2024-12-31
   */
  @Get('sales')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Export sales report (CSV or XLSX)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'status', enum: SaleStatus, required: false })
  async exportSales(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('xlsx')) format: 'csv' | 'xlsx',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: SaleStatus,
  ) {
    await this.exportService.exportSalesReport(res, format, { startDate, endDate, status });
  }

  /**
   * GET /api/v1/export/tax?format=xlsx&year=2024
   */
  @Get('tax')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Export tax report (CSV or XLSX)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'quarter', required: false })
  @ApiQuery({ name: 'realtorId', required: false })
  async exportTax(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('xlsx')) format: 'csv' | 'xlsx',
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
    @Query('realtorId') realtorId?: string,
  ) {
    await this.exportService.exportTaxReport(res, format, {
      year: year ? parseInt(year, 10) : undefined,
      quarter: quarter ? parseInt(quarter, 10) : undefined,
      realtorId,
    });
  }

  /**
   * GET /api/v1/export/payroll?format=xlsx&month=3&year=2024
   */
  @Get('payroll')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'HR')
  @ApiOperation({ summary: 'Export payroll report (CSV or XLSX)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'status', enum: PayrollStatus, required: false })
  async exportPayroll(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('xlsx')) format: 'csv' | 'xlsx',
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('status') status?: PayrollStatus,
  ) {
    await this.exportService.exportPayrollReport(res, format, {
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      status,
    });
  }

  /**
   * GET /api/v1/export/audit?format=xlsx&startDate=...
   */
  @Get('audit')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Export audit log (CSV or XLSX)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  async exportAudit(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('xlsx')) format: 'csv' | 'xlsx',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    await this.exportService.exportAuditLog(res, format, { startDate, endDate, userId, action });
  }

  /**
   * GET /api/v1/export/commission?format=xlsx&realtorId=...
   */
  @Get('commission')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Export commission report (CSV or XLSX)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'realtorId', required: false })
  async exportCommission(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('xlsx')) format: 'csv' | 'xlsx',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('realtorId') realtorId?: string,
  ) {
    await this.exportService.exportCommissionReport(res, format, { startDate, endDate, realtorId });
  }
}
