import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { MasterPlatformService } from './master-platform.service';
import { MasterPrismaService } from '../../database/master-prisma.service';
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
  constructor(
    private readonly service: MasterPlatformService,
    private readonly masterPrisma: MasterPrismaService,
  ) {}

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

  /**
   * Bootstrap: create OR reset the super admin account.
   * Protected by MASTER_API_SECRET env var — NOT JWT-guarded.
   *
   * Use after first deployment OR to reset a forgotten super admin password:
   *   POST /api/v1/master/platform-settings/bootstrap
   *   Body: { secret: "<MASTER_API_SECRET>", email?, password?, firstName?, lastName? }
   *
   * If the super admin already exists, the password is updated.
   */
  @Post('bootstrap')
  @ApiOperation({ summary: 'Create or reset super admin (requires MASTER_API_SECRET)' })
  @ApiResponse({ status: 200, description: 'Super admin created or updated' })
  async bootstrap(
    @Body() body: {
      secret: string;
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    },
  ) {
    const masterSecret = process.env.MASTER_API_SECRET;
    if (!masterSecret || body.secret !== masterSecret) {
      throw new UnauthorizedException('Invalid bootstrap secret');
    }

    const email = (body.email || 'superadmin@rms.com').toLowerCase().trim();
    const password = body.password || 'SuperAdmin123!';
    const firstName = body.firstName || 'Platform';
    const lastName = body.lastName || 'Admin';

    const hashed = await bcrypt.hash(password, 12);

    const admin = await this.masterPrisma.superAdmin.upsert({
      where: { email },
      update: { password: hashed, firstName, lastName },
      create: { email, password: hashed, firstName, lastName },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    });

    // Run DB schema migration so login works even on un-migrated tenant databases
    const migration = await this.service.migrateUserVerificationColumns().catch((e) => ({
      migrated: 0, failed: -1, errors: [e.message],
    }));

    return {
      message: 'Super admin ready',
      admin,
      credentials: { email, password },
      migration,
    };
  }
}
