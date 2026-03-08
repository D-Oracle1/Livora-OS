import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommissionService } from './commission.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommissionStatus, LoyaltyTier } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Commission')
@Controller('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CommissionController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'REALTOR')
  @ApiOperation({ summary: 'Get all commissions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'realtorId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CommissionStatus })
  @ApiResponse({ status: 200, description: 'List of commissions' })
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('realtorId') realtorId?: string,
    @Query('status') status?: CommissionStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // REALTOR must always be scoped to their own profile — ignore any supplied realtorId
    if (role === 'REALTOR') {
      const realtor = await this.prisma.realtorProfile.findUnique({ where: { userId } });
      realtorId = realtor?.id;
    }
    return this.commissionService.findAll({
      page,
      limit,
      realtorId,
      status,
      startDate,
      endDate,
    });
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get commission statistics' })
  @ApiQuery({ name: 'realtorId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Commission statistics' })
  async getStats(@Query('realtorId') realtorId?: string) {
    return this.commissionService.getStats(realtorId);
  }

  @Get('calculate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REALTOR')
  @ApiOperation({ summary: 'Calculate commission for a sale' })
  @ApiQuery({ name: 'saleValue', required: true, type: Number })
  @ApiQuery({ name: 'tier', required: true, enum: LoyaltyTier })
  @ApiResponse({ status: 200, description: 'Commission calculation' })
  async calculateCommission(
    @Query('saleValue') saleValue: number,
    @Query('tier') tier: LoyaltyTier,
  ) {
    return this.commissionService.calculateCommission(saleValue, tier);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REALTOR')
  @ApiOperation({ summary: 'Get commission by ID' })
  @ApiResponse({ status: 200, description: 'Commission details' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const commission = await this.commissionService.findById(id);
    // REALTOR may only view their own commission records
    if (role === 'REALTOR') {
      const realtor = await this.prisma.realtorProfile.findUnique({ where: { userId } });
      if (!realtor || commission.realtorId !== realtor.id) {
        throw new ForbiddenException('Access denied');
      }
    }
    return commission;
  }

  @Post(':id/pay')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Mark commission as paid' })
  @ApiResponse({ status: 200, description: 'Commission marked as paid' })
  async markAsPaid(
    @Param('id') id: string,
    @Body() body: { paymentMethod?: string; paymentReference?: string; paymentNotes?: string },
  ) {
    return this.commissionService.markAsPaid(id, body);
  }
}
