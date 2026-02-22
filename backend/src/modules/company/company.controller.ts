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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsInt, Min, Matches, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class AssignRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'REALTOR', 'CLIENT', 'STAFF', 'GENERAL_OVERSEER'], description: 'Role to assign' })
  @IsEnum(['ADMIN', 'REALTOR', 'CLIENT', 'STAFF', 'GENERAL_OVERSEER'])
  role: string;
}

class RegisterExistingDbDto {
  @ApiProperty({ example: 'RMS Platform' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'rms-platform' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @ApiProperty({ example: 'rms.vercel.app' })
  @IsString()
  domain: string;

  @ApiProperty({ description: 'Existing PostgreSQL connection string' })
  @IsString()
  databaseUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;
}

class BulkPurgeDto {
  @ApiProperty({ type: [String], description: 'Array of company IDs to permanently delete' })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

@ApiTags('Companies')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // ── Public endpoints (no auth) ──

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve company from current domain or invite code' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'code', required: false })
  @ApiResponse({ status: 200, description: 'Company info' })
  async resolve(
    @Query('domain') domain?: string,
    @Query('code') code?: string,
  ) {
    if (code) {
      return this.companyService.resolveByInviteCode(code);
    }
    if (domain) {
      return this.companyService.resolveByDomain(domain);
    }
    return null;
  }

  // ── SUPER_ADMIN endpoints ──

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new company (provisions dedicated DB)' })
  @ApiResponse({ status: 201, description: 'Company created' })
  async create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all companies' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Paginated companies list' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.companyService.findAll({ page, limit, search });
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get overview stats across all companies' })
  @ApiResponse({ status: 200, description: 'Aggregated stats' })
  async getOverview() {
    return this.companyService.getOverviewStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get company details' })
  @ApiResponse({ status: 200, description: 'Company detail with stats' })
  async findById(@Param('id') id: string) {
    return this.companyService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update company' })
  @ApiResponse({ status: 200, description: 'Updated company' })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle company active status' })
  @ApiResponse({ status: 200, description: 'Updated status' })
  async toggleActive(@Param('id') id: string) {
    return this.companyService.toggleActive(id);
  }

  @Post(':id/regenerate-invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Regenerate invite code for a company' })
  @ApiResponse({ status: 200, description: 'New invite code' })
  async regenerateInviteCode(@Param('id') id: string) {
    return this.companyService.regenerateInviteCode(id);
  }

  @Get(':id/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List users of a tenant company' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated tenant users' })
  async getCompanyUsers(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.companyService.getCompanyUsers(id, { page, limit });
  }

  @Patch(':id/users/:userId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assign a role to a tenant user' })
  @ApiResponse({ status: 200, description: 'Updated user role' })
  async assignUserRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.companyService.assignUserRole(id, userId, dto.role);
  }

  @Post('register-existing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register an existing database as a company (no provisioning)' })
  @ApiResponse({ status: 201, description: 'Company registered' })
  async registerExisting(@Body() dto: RegisterExistingDbDto) {
    return this.companyService.registerExisting(dto);
  }

  @Post(':id/reprovision')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Re-apply tenant schema DDL (migrate existing tenant DB)' })
  @ApiResponse({ status: 200, description: 'Tenant schema migrated' })
  async reprovision(@Param('id') id: string) {
    return this.companyService.reprovisionTenant(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Permanently delete a company and purge all tenant data + files' })
  @ApiResponse({ status: 200, description: 'Company deleted' })
  async purgeCompany(@Param('id') id: string) {
    return this.companyService.purgeTenant(id);
  }

  @Post('bulk-purge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Permanently delete multiple companies and all their tenant data' })
  @ApiResponse({ status: 200, description: 'Bulk purge result' })
  async bulkPurge(@Body() dto: BulkPurgeDto) {
    return this.companyService.bulkPurgeTenants(dto.ids);
  }

  @Post('migrate-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Apply latest tenant schema DDL to all active companies' })
  @ApiResponse({ status: 200, description: 'Migration results' })
  async migrateAll() {
    return this.companyService.migrateAllTenants();
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Export all tenant data as a multi-sheet Excel workbook' })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportTenantData(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.companyService.exportTenantData(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
