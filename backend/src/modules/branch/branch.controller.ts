import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { TransferPropertyDto } from './dto/transfer-property.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Branches')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Create a new branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all branches' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('city') city?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.branchService.findAll({
      city,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by ID' })
  findOne(@Param('id') id: string) {
    return this.branchService.findOne(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Update branch' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Delete branch' })
  remove(@Param('id') id: string) {
    return this.branchService.remove(id);
  }

  // ─── Stats & Reporting ──────────────────────────────────────────────────────

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get branch performance stats' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getStats(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.branchService.getStats(id, startDate, endDate);
  }

  @Get(':id/agents')
  @ApiOperation({ summary: 'Get agent performance within a branch' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAgentPerformance(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.branchService.getAgentPerformance(id, startDate, endDate);
  }

  @Get('reports/all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Consolidated report for all branches' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAllBranchesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.branchService.getAllBranchesReport(startDate, endDate);
  }

  // ─── Property Transfers ─────────────────────────────────────────────────────

  @Post('properties/:propertyId/transfer')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Initiate a property transfer to another branch' })
  @ApiParam({ name: 'propertyId' })
  initiateTransfer(
    @Param('propertyId') propertyId: string,
    @Body() dto: TransferPropertyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.branchService.initiateTransfer(propertyId, dto, userId);
  }

  @Patch('transfers/:transferId/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Approve a property transfer' })
  approveTransfer(
    @Param('transferId') transferId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.branchService.approveTransfer(transferId, userId);
  }

  @Patch('transfers/:transferId/reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Reject a property transfer' })
  rejectTransfer(
    @Param('transferId') transferId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.branchService.rejectTransfer(transferId, userId);
  }

  @Get('transfers/list')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'List property transfers' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  getTransfers(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.branchService.getTransfers(branchId, status);
  }

  // ─── Geo Assignment ─────────────────────────────────────────────────────────

  @Get('geo/nearest')
  @ApiOperation({ summary: 'Find nearest branch to a coordinate' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  findNearest(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.branchService.findNearestBranch(parseFloat(lat), parseFloat(lng));
  }

  // ─── User Assignment ────────────────────────────────────────────────────────

  @Post(':branchId/users/:userId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Assign a user to a branch' })
  assignUser(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.branchService.assignUserToBranch(userId, branchId, role);
  }

  @Delete(':branchId/users/:userId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Remove a user from a branch' })
  removeUser(@Param('userId') userId: string, @CurrentUser('role') role: string) {
    return this.branchService.removeUserFromBranch(userId, role);
  }
}
