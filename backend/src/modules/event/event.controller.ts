import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { EventService } from './event.service';
import { RegistrationService } from './registration.service';
import { EventAnalyticsService } from './analytics.service';

import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto, UpdateEventStatusDto } from './dto/update-event.dto';
import { CreateRegistrationDto, CheckInDto } from './dto/create-registration.dto';
import { EventQueryDto } from './dto/event-query.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { EventStatus, RegistrationStatus } from '@prisma/client';

@ApiTags('Events')
@Controller('events')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly registrationService: RegistrationService,
    private readonly analyticsService: EventAnalyticsService,
  ) {}

  // ── PUBLIC ENDPOINTS ───────────────────────────────────────────────────────

  @Get('homepage')
  @Public()
  @ApiOperation({ summary: 'Get featured, upcoming and closing-soon events for homepage' })
  async getHomepage() {
    return this.eventService.getHomepageEvents();
  }

  @Get('public/:slug')
  @Public()
  @ApiOperation({ summary: 'Get public event details by slug' })
  @ApiResponse({ status: 200, description: 'Event details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getPublicEvent(@Param('slug') slug: string, @Req() req: Request) {
    const event = await this.eventService.findBySlug(slug);
    // Fire-and-forget view tracking
    this.analyticsService.incrementViews((event as any).id).catch(() => null);
    return event;
  }

  @Post('public/:eventId/register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register for an event (public)' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  async registerForEvent(
    @Param('eventId') eventId: string,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.registrationService.register(eventId, dto);
  }

  // ── QR CHECK-IN (admin/staff use) ─────────────────────────────────────────

  @Post('checkin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'STAFF', 'GENERAL_OVERSEER')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Process QR code check-in' })
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  async checkIn(@Body() dto: CheckInDto) {
    return this.registrationService.checkIn(dto);
  }

  // ── ADMIN: EVENTS CRUD ─────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new event' })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all events (admin)' })
  async findAll(@Query() query: EventQueryDto) {
    return this.eventService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get event by ID (admin)' })
  async findOne(@Param('id') id: string) {
    return this.eventService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update event' })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish, unpublish, or close an event' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
  ) {
    return this.eventService.updateStatus(id, dto.status as EventStatus);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete event (cascades registrations)' })
  async remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }

  // ── ADMIN: REGISTRATIONS ───────────────────────────────────────────────────

  @Get(':id/registrations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER', 'HR', 'STAFF')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List registrations for an event' })
  async getRegistrations(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('status') status?: string,
  ) {
    return this.registrationService.findByEvent(id, +page, +limit, status);
  }

  @Patch('registrations/:registrationId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a registration' })
  async updateRegistrationStatus(
    @Param('registrationId') id: string,
    @Body('status') status: string,
  ) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status');
    }
    return this.registrationService.updateStatus(id, status as RegistrationStatus);
  }

  // ── ADMIN: ANALYTICS ───────────────────────────────────────────────────────

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get analytics for an event' })
  async getAnalytics(@Param('id') id: string) {
    return this.analyticsService.getAnalytics(id);
  }
}
