import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SalaryConfigService } from '../services/salary-config.service';
import {
  CreateAllowanceConfigDto,
  UpdateAllowanceConfigDto,
  CreateDeductionConfigDto,
  UpdateDeductionConfigDto,
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  UpdateStaffSalaryDto,
  StaffPosition,
} from '../dto/salary-config.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('HR - Salary Configuration')
@Controller('hr/salary-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SalaryConfigController {
  constructor(private readonly salaryConfigService: SalaryConfigService) {}

  // ===========================================
  // SUMMARY
  // ===========================================

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get salary configuration summary' })
  getSummary() {
    return this.salaryConfigService.getSalaryConfigSummary();
  }

  // ===========================================
  // ALLOWANCE ENDPOINTS
  // ===========================================

  @Post('allowances')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Create allowance configuration' })
  createAllowance(@Body() dto: CreateAllowanceConfigDto) {
    return this.salaryConfigService.createAllowanceConfig(dto);
  }

  @Get('allowances')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all allowance configurations' })
  @ApiQuery({ name: 'isActive', required: false })
  findAllAllowances(@Query('isActive') isActive?: string) {
    return this.salaryConfigService.findAllAllowanceConfigs(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    );
  }

  @Get('allowances/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get allowance configuration by ID' })
  findAllowanceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryConfigService.findAllowanceConfigById(id);
  }

  @Put('allowances/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Update allowance configuration' })
  updateAllowance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAllowanceConfigDto,
  ) {
    return this.salaryConfigService.updateAllowanceConfig(id, dto);
  }

  @Delete('allowances/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Delete allowance configuration' })
  deleteAllowance(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryConfigService.deleteAllowanceConfig(id);
  }

  // ===========================================
  // DEDUCTION ENDPOINTS
  // ===========================================

  @Post('deductions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Create deduction configuration' })
  createDeduction(@Body() dto: CreateDeductionConfigDto) {
    return this.salaryConfigService.createDeductionConfig(dto);
  }

  @Get('deductions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all deduction configurations' })
  @ApiQuery({ name: 'isActive', required: false })
  findAllDeductions(@Query('isActive') isActive?: string) {
    return this.salaryConfigService.findAllDeductionConfigs(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    );
  }

  @Get('deductions/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get deduction configuration by ID' })
  findDeductionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryConfigService.findDeductionConfigById(id);
  }

  @Put('deductions/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Update deduction configuration' })
  updateDeduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeductionConfigDto,
  ) {
    return this.salaryConfigService.updateDeductionConfig(id, dto);
  }

  @Delete('deductions/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Delete deduction configuration' })
  deleteDeduction(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryConfigService.deleteDeductionConfig(id);
  }

  // ===========================================
  // SALARY STRUCTURE ENDPOINTS
  // ===========================================

  @Post('structures')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Create salary structure' })
  createStructure(@Body() dto: CreateSalaryStructureDto) {
    return this.salaryConfigService.createSalaryStructure(dto);
  }

  @Get('structures')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all salary structures' })
  @ApiQuery({ name: 'isActive', required: false })
  findAllStructures(@Query('isActive') isActive?: string) {
    return this.salaryConfigService.findAllSalaryStructures(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    );
  }

  @Get('structures/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get salary structure by ID' })
  findStructureById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryConfigService.findSalaryStructureById(id);
  }

  @Get('structures/position/:position')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get salary structure by position' })
  findStructureByPosition(@Param('position') position: StaffPosition) {
    return this.salaryConfigService.findSalaryStructureByPosition(position);
  }

  @Put('structures/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Update salary structure' })
  updateStructure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryStructureDto,
  ) {
    return this.salaryConfigService.updateSalaryStructure(id, dto);
  }

  @Delete('structures/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Delete salary structure' })
  deleteStructure(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryConfigService.deleteSalaryStructure(id);
  }

  // ===========================================
  // STAFF SALARY MANAGEMENT
  // ===========================================

  @Put('staff/:staffProfileId/salary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Update staff salary' })
  updateStaffSalary(
    @Param('staffProfileId', ParseUUIDPipe) staffProfileId: string,
    @Body() dto: UpdateStaffSalaryDto,
  ) {
    return this.salaryConfigService.updateStaffSalary(staffProfileId, dto);
  }

  @Get('staff/:staffProfileId/allowances')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Calculate allowances for staff' })
  calculateStaffAllowances(@Param('staffProfileId', ParseUUIDPipe) staffProfileId: string) {
    return this.salaryConfigService.calculateAllowancesForStaff(staffProfileId);
  }

  @Get('staff/:staffProfileId/deductions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Calculate deductions for staff' })
  @ApiQuery({ name: 'grossPay', required: true })
  calculateStaffDeductions(
    @Param('staffProfileId', ParseUUIDPipe) staffProfileId: string,
    @Query('grossPay') grossPay: number,
  ) {
    return this.salaryConfigService.calculateDeductionsForStaff(staffProfileId, Number(grossPay));
  }
}
