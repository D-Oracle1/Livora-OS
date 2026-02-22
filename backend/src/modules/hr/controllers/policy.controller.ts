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
import { PolicyService } from '../services/policy.service';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  CreatePenaltyDto,
  WaivePenaltyDto,
  PolicyType,
} from '../dto/policy.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('HR - Policies')
@Controller('hr/policies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  // ===========================================
  // POLICY ENDPOINTS
  // ===========================================

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Create a new HR policy' })
  createPolicy(@Body() dto: CreatePolicyDto) {
    return this.policyService.createPolicy(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all HR policies' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'type', required: false, enum: PolicyType })
  @ApiQuery({ name: 'isActive', required: false })
  findAllPolicies(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: PolicyType,
    @Query('isActive') isActive?: string,
  ) {
    return this.policyService.findAllPolicies({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get policy by ID' })
  findPolicyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.policyService.findPolicyById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Update policy' })
  updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policyService.updatePolicy(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Delete policy' })
  deletePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.policyService.deletePolicy(id);
  }

  // ===========================================
  // PENALTY ENDPOINTS
  // ===========================================

  @Post('penalties')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Create a penalty record' })
  createPenalty(@Body() dto: CreatePenaltyDto) {
    return this.policyService.createPenalty(dto);
  }

  @Get('penalties/all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all penalties' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'staffProfileId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: PolicyType })
  @ApiQuery({ name: 'isApplied', required: false })
  @ApiQuery({ name: 'isWaived', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAllPenalties(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('type') type?: PolicyType,
    @Query('isApplied') isApplied?: string,
    @Query('isWaived') isWaived?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.policyService.findAllPenalties({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      staffProfileId,
      type,
      isApplied: isApplied === 'true' ? true : isApplied === 'false' ? false : undefined,
      isWaived: isWaived === 'true' ? true : isWaived === 'false' ? false : undefined,
      startDate,
      endDate,
    });
  }

  @Get('penalties/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get penalty by ID' })
  findPenaltyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.policyService.findPenaltyById(id);
  }

  @Put('penalties/:id/waive')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Waive a penalty' })
  waivePenalty(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: WaivePenaltyDto,
  ) {
    return this.policyService.waivePenalty(id, userId, dto);
  }

  @Get('penalties/staff/:staffProfileId/summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get penalty summary for a staff member' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getStaffPenaltySummary(
    @Param('staffProfileId', ParseUUIDPipe) staffProfileId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.policyService.getStaffPenaltySummary(staffProfileId, startDate, endDate);
  }

  @Get('penalties/staff/:staffProfileId/pending')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get pending penalties for payroll' })
  getPendingPenalties(@Param('staffProfileId', ParseUUIDPipe) staffProfileId: string) {
    return this.policyService.getPendingPenaltiesForPayroll(staffProfileId);
  }
}
