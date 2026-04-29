import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  private companyId(req: Request): string {
    return req.tenant?.companyId ?? '';
  }

  // ─── List / CRUD ─────────────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  findAll(@Req() req: Request) {
    return this.service.findAll(this.companyId(req));
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.service.delete(id, this.companyId(req));
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, this.companyId(req), dto);
  }

  // ─── Meta Lead Forms ──────────────────────────────────────────────────────────

  @Get(':id/meta/forms')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  pullMetaForms(@Req() req: Request, @Param('id') id: string) {
    return this.service.pullMetaLeadForms(id, this.companyId(req));
  }

  @Post(':id/meta/refresh')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  refreshMeta(@Req() req: Request, @Param('id') id: string) {
    return this.service.refreshMetaToken(id, this.companyId(req));
  }

  @Post(':id/google/refresh')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  refreshGoogle(@Req() req: Request, @Param('id') id: string) {
    return this.service.refreshGoogleToken(id, this.companyId(req));
  }

  // ─── Meta OAuth ───────────────────────────────────────────────────────────────

  @Get('meta/connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Get Meta OAuth URL' })
  getMetaAuthUrl(@Req() req: Request) {
    const url = this.service.getMetaAuthUrl(this.companyId(req));
    return { url };
  }

  @Get('meta/callback')
  @Public()
  @ApiOperation({ summary: 'Meta OAuth callback (redirect)' })
  async metaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const redirectUrl = await this.service.handleMetaCallback(code, state);
      return res.redirect(redirectUrl);
    } catch (err) {
      return res.redirect(`/dashboard/admin/crm/integrations?error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────────

  @Get('google/connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Get Google OAuth URL' })
  getGoogleAuthUrl(@Req() req: Request) {
    const url = this.service.getGoogleAuthUrl(this.companyId(req));
    return { url };
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Google OAuth callback (redirect)' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const redirectUrl = await this.service.handleGoogleCallback(code, state);
      return res.redirect(redirectUrl);
    } catch (err) {
      return res.redirect(`/dashboard/admin/crm/integrations?error=${encodeURIComponent(err.message)}`);
    }
  }
}
