import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@ApiTags('Leads CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  private companyId(req: Request): string {
    return req.tenant?.companyId ?? '';
  }

  // ─── Leads CRUD ──────────────────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF', 'HR')
  @ApiOperation({ summary: 'List leads with filters' })
  findAll(@Req() req: Request, @Query() query: any) {
    return this.leadsService.findAll(this.companyId(req), query);
  }

  @Get('pipeline')
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF', 'HR')
  @ApiOperation({ summary: 'Get Kanban pipeline board' })
  getPipeline(@Req() req: Request) {
    return this.leadsService.getPipelineBoard(this.companyId(req));
  }

  @Get('reports')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Lead analytics reports' })
  getReports(@Req() req: Request, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.leadsService.getReports(this.companyId(req), dateFrom, dateTo);
  }

  @Get('staff-performance')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Staff response and conversion performance' })
  getStaffPerformance(@Req() req: Request) {
    return this.leadsService.getStaffPerformance(this.companyId(req));
  }

  @Get('assignment-rules')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Get all assignment rules' })
  getAssignmentRules(@Req() req: Request) {
    return this.leadsService.getAssignmentRules(this.companyId(req));
  }

  @Post('assignment-rules')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Create assignment rule' })
  createAssignmentRule(@Req() req: Request, @Body() dto: any) {
    return this.leadsService.createAssignmentRule(this.companyId(req), dto);
  }

  @Patch('assignment-rules/:ruleId')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  updateAssignmentRule(@Req() req: Request, @Param('ruleId') ruleId: string, @Body() dto: any) {
    return this.leadsService.updateAssignmentRule(ruleId, this.companyId(req), dto);
  }

  @Delete('assignment-rules/:ruleId')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAssignmentRule(@Req() req: Request, @Param('ruleId') ruleId: string) {
    return this.leadsService.deleteAssignmentRule(ruleId, this.companyId(req));
  }

  @Get('forms')
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF')
  getLeadForms(@Req() req: Request) {
    return this.leadsService.getLeadForms(this.companyId(req));
  }

  @Post('forms')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  createLeadForm(@Req() req: Request, @Body() dto: any) {
    return this.leadsService.createLeadForm(this.companyId(req), dto);
  }

  @Get(':id')
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF', 'HR')
  @ApiOperation({ summary: 'Get lead detail with full history' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.leadsService.findOne(id, this.companyId(req));
  }

  @Post()
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF')
  @ApiOperation({ summary: 'Manually create a lead' })
  create(@Req() req: Request, @Body() dto: CreateLeadDto) {
    return this.leadsService.ingestLead(dto, this.companyId(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF')
  @ApiOperation({ summary: 'Update lead details' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.update(id, this.companyId(req), dto, user?.id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF')
  @ApiOperation({ summary: 'Move lead to pipeline stage' })
  moveStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.moveLeadStatus(id, this.companyId(req), status, user?.id);
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'STAFF')
  @ApiOperation({ summary: 'Add note to lead' })
  addNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.addNote(id, this.companyId(req), content, user?.id);
  }

  @Post(':id/score')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiOperation({ summary: 'Recalculate lead score' })
  rescore(@Param('id') id: string) {
    return this.leadsService.scoreLead(id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.leadsService.softDelete(id, this.companyId(req));
  }
}
