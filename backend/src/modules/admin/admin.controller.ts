import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { AdminResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LoyaltyTier } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('setup-overseer')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create or reset the General Overseer account' })
  @ApiResponse({ status: 201, description: 'General Overseer account created/reset' })
  async setupOverseer() {
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.upsert({
      where: { email: 'overseer@rms.com' },
      update: {
        password: hashedPassword,
        status: UserStatus.ACTIVE,
        role: UserRole.GENERAL_OVERSEER,
      },
      create: {
        email: 'overseer@rms.com',
        password: hashedPassword,
        firstName: 'General',
        lastName: 'Overseer',
        phone: '+1234567893',
        role: UserRole.GENERAL_OVERSEER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        referralCode: 'REF-OVSEER01',
      },
      select: { id: true, email: true, role: true, status: true },
    });

    return {
      message: 'General Overseer account ready',
      user,
      credentials: { email: 'overseer@rms.com', password },
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  @ApiQuery({ name: 'month', required: false, type: Number, description: '0-11' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async getDashboardStats(
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.adminService.getDashboardStats(period, month, year);
  }

  @Get('realtors')
  @ApiOperation({ summary: 'Get realtor monitoring data' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'tier', required: false, enum: LoyaltyTier })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Realtor monitoring data' })
  async getRealtorMonitoring(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('tier') tier?: LoyaltyTier,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.adminService.getRealtorMonitoring({
      page,
      limit,
      search,
      tier,
      sortBy,
      sortOrder,
    });
  }

  @Get('realtors/:id')
  @ApiOperation({ summary: 'Get realtor drill-down view' })
  @ApiResponse({ status: 200, description: 'Realtor details' })
  async getRealtorDrilldown(@Param('id') id: string) {
    return this.adminService.getRealtorDrilldown(id);
  }

  @Get('sales-feed')
  @ApiOperation({ summary: 'Get real-time sales feed' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Recent sales' })
  async getRecentSalesFeed(@Query('limit') limit?: number) {
    return this.adminService.getRecentSalesFeed(limit);
  }

  @Patch('users/:userId/reset-password')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Admin reset of any user password' })
  @ApiResponse({ status: 200, description: 'Password reset. Returns temporaryPassword if auto-generated.' })
  async resetUserPassword(
    @Param('userId') userId: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    let password = dto.newPassword?.trim();
    let generated = false;
    if (!password) {
      // Generate a strong random password
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
      password = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      generated = true;
    }
    await this.authService.adminResetPassword(userId, password);
    return {
      success: true,
      message: 'Password reset successfully. User will need to log in again.',
      ...(generated ? { temporaryPassword: password } : {}),
    };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get performance analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Year for the analytics data' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Month (0-11) for monthly period' })
  @ApiResponse({ status: 200, description: 'Performance analytics' })
  async getPerformanceAnalytics(
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.adminService.getPerformanceAnalytics(period, year, month);
  }
}
