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
import { LeaveService } from '../services/leave.service';
import { CreateLeaveRequestDto, ApproveLeaveDto, RejectLeaveDto } from '../dto/leave.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { LeaveType, LeaveStatus } from '@prisma/client';

@ApiTags('HR - Leave')
@Controller('hr/leave')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Roles('STAFF')
  @ApiOperation({ summary: 'Submit a leave request' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateLeaveRequestDto) {
    return this.leaveService.create(userId, dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Get all leave requests' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'staffProfileId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: LeaveType })
  @ApiQuery({ name: 'status', required: false, enum: LeaveStatus })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('type') type?: LeaveType,
    @Query('status') status?: LeaveStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.leaveService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      staffProfileId,
      departmentId,
      type,
      status,
      startDate,
      endDate,
    });
  }

  @Get('balance')
  @Roles('STAFF')
  @ApiOperation({ summary: 'Get my leave balance' })
  getBalance(@CurrentUser('id') userId: string) {
    return this.leaveService.getBalance(userId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Get leave request by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaveService.findById(id);
  }

  @Put(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Approve a leave request' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveService.approve(id, approverId, dto);
  }

  @Put(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Reject a leave request' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveService.reject(id, approverId, dto);
  }

  @Delete(':id')
  @Roles('STAFF')
  @ApiOperation({ summary: 'Cancel a leave request' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.leaveService.cancel(id, userId);
  }
}
