import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('commission-rates')
  @ApiOperation({ summary: 'Get commission rates by tier' })
  @ApiResponse({ status: 200, description: 'Commission rates object' })
  async getCommissionRates() {
    return this.settingsService.getCommissionRates();
  }

  @Put('commission-rates')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update commission rates by tier' })
  @ApiResponse({ status: 200, description: 'Updated commission rates' })
  async updateCommissionRates(
    @Body(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
    rates: Record<string, number>,
  ) {
    return this.settingsService.updateCommissionRates(rates);
  }

  @Get('tax-rates')
  @ApiOperation({ summary: 'Get tax rates' })
  @ApiResponse({ status: 200, description: 'Tax rates object' })
  async getTaxRates() {
    return this.settingsService.getTaxRates();
  }

  @Put('tax-rates')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update tax rates' })
  @ApiResponse({ status: 200, description: 'Updated tax rates' })
  async updateTaxRates(
    @Body(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
    rates: Record<string, number>,
  ) {
    return this.settingsService.updateTaxRates(rates);
  }

  @Get('payroll')
  @ApiOperation({ summary: 'Get payroll settings (pension, tax toggles and rates)' })
  async getPayrollSettings() {
    return this.settingsService.getPayrollSettings();
  }

  @Put('payroll')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update payroll settings' })
  async updatePayrollSettings(
    @Body(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
    settings: any,
  ) {
    return this.settingsService.updatePayrollSettings(settings);
  }

  // ============ Notification Preferences (per-user) ============

  @Get('notifications')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences object' })
  async getNotificationPrefs(@CurrentUser('id') userId: string) {
    return this.settingsService.getNotificationPreferences(userId);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated notification preferences' })
  async updateNotificationPrefs(
    @CurrentUser('id') userId: string,
    @Body(new ValidationPipe({ whitelist: false, transform: true })) prefs: Record<string, boolean>,
  ) {
    return this.settingsService.updateNotificationPreferences(userId, prefs);
  }
}
