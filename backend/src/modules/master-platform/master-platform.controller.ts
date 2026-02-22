import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MasterPlatformService } from './master-platform.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class UpdateBrandingDto {
  @ApiPropertyOptional({ example: 'RMS Platform' })
  @IsOptional()
  @IsString()
  platformName?: string;

  @ApiPropertyOptional({ description: 'Logo URL or upload path' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: 'Powering Real Estate Excellence' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  favicon?: string;
}

class UpdateCmsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroSubtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportEmail?: string;
}

@ApiTags('Master Platform Settings')
@Controller('master/platform-settings')
export class MasterPlatformController {
  constructor(private readonly service: MasterPlatformService) {}

  /**
   * Public: returns platform branding for the admin deployment's UI
   */
  @Get('public')
  @ApiOperation({ summary: 'Get platform branding (public — no auth required)' })
  @ApiResponse({ status: 200, description: 'Platform branding data' })
  async getPublic() {
    return this.service.getSettings('platform_branding');
  }

  /**
   * Super admin: get all platform settings (branding + cms)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all platform settings (super admin only)' })
  @ApiResponse({ status: 200, description: 'Platform settings' })
  async getAll() {
    return this.service.getAllSettings();
  }

  /**
   * Super admin: update platform branding
   */
  @Put('branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update platform branding (super admin only)' })
  @ApiResponse({ status: 200, description: 'Updated branding' })
  async updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.service.updateSettings('platform_branding', dto);
  }

  /**
   * Super admin: update platform CMS content
   */
  @Put('cms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update platform CMS content (super admin only)' })
  @ApiResponse({ status: 200, description: 'Updated CMS content' })
  async updateCms(@Body() dto: UpdateCmsDto) {
    return this.service.updateSettings('platform_cms', dto);
  }

  /**
   * Super admin: sync master database schema (idempotent DDL)
   */
  @Post('migrate-db')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Apply master DB schema (idempotent — safe to run any time)' })
  @ApiResponse({ status: 200, description: 'Master schema synced' })
  async migrateDb() {
    return this.service.syncMasterSchema();
  }
}
