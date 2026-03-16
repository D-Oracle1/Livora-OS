import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PayrollService } from '../services/payroll.service';
import { GeneratePayrollDto, UpdatePayrollDto, ApprovePayrollDto } from '../dto/payroll.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PayrollStatus } from '@prisma/client';

@ApiTags('HR - Payroll')
@Controller('hr/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Generate payroll for a period' })
  generate(@Body() dto: GeneratePayrollDto) {
    return this.payrollService.generate(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all payroll records' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'staffProfileId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PayrollStatus })
  @ApiQuery({ name: 'periodStart', required: false })
  @ApiQuery({ name: 'periodEnd', required: false })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: PayrollStatus,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.payrollService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      staffProfileId,
      departmentId,
      status,
      periodStart,
      periodEnd,
    });
  }

  @Get('my')
  @Roles('STAFF')
  @ApiOperation({ summary: 'Get my payslips' })
  getMyPayslips(@CurrentUser('id') userId: string) {
    return this.payrollService.getMyPayslips(userId);
  }

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get payroll summary' })
  @ApiQuery({ name: 'periodStart', required: true })
  @ApiQuery({ name: 'periodEnd', required: true })
  @ApiQuery({ name: 'departmentId', required: false })
  getSummary(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.payrollService.getSummary({ periodStart, periodEnd, departmentId });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Get payroll record by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.findById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Update payroll record' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePayrollDto) {
    return this.payrollService.update(id, dto);
  }

  @Put(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Approve payroll' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
    @Body() dto: ApprovePayrollDto,
  ) {
    return this.payrollService.approve(id, approverId, dto);
  }

  @Post('bulk-approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Bulk approve payroll' })
  bulkApprove(
    @CurrentUser('id') approverId: string,
    @Body() body: { ids: string[]; payDate?: string },
  ) {
    return this.payrollService.bulkApprove(body.ids, approverId, body.payDate);
  }

  @Put(':id/paid')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Mark payroll as paid' })
  markAsPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.markAsPaid(id);
  }

  @Post(':id/recalculate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Recalculate payroll deductions using current settings, allowances, and penalties (DRAFT/PENDING only)' })
  recalculate(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.recalculate(id);
  }
}
