import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SubscribeDto, SendNewsletterDto } from './dto/newsletter.dto';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  // ============ Public Routes ============

  @Post('subscribe')
  @Public()
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  @ApiResponse({ status: 201, description: 'Subscribed successfully' })
  async subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto.email, dto.name);
  }

  @Get('unsubscribe/:token')
  @Public()
  @ApiOperation({ summary: 'Unsubscribe from newsletter' })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  async unsubscribe(@Param('token') token: string) {
    return this.newsletterService.unsubscribe(token);
  }

  // ============ Admin Routes ============

  @Get('subscribers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all newsletter subscribers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of subscribers' })
  async getSubscribers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.newsletterService.getSubscribers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get newsletter statistics' })
  @ApiResponse({ status: 200, description: 'Newsletter stats' })
  async getStats() {
    return this.newsletterService.getStats();
  }

  @Delete('subscribers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a subscriber' })
  @ApiResponse({ status: 200, description: 'Subscriber deleted' })
  async deleteSubscriber(@Param('id') id: string) {
    return this.newsletterService.deleteSubscriber(id);
  }

  @Get('recipients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get recipients list by type' })
  @ApiQuery({ name: 'type', required: true, enum: ['SUBSCRIBERS', 'CLIENTS', 'STAFF', 'REALTORS'] })
  @ApiResponse({ status: 200, description: 'Recipient list' })
  async getRecipients(@Query('type') type: 'SUBSCRIBERS' | 'CLIENTS' | 'STAFF' | 'REALTORS') {
    return this.newsletterService.getRecipients(type);
  }

  @Get('counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get recipient counts for all types' })
  @ApiResponse({ status: 200, description: 'Counts by type' })
  async getCounts() {
    return this.newsletterService.getCounts();
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send bulk newsletter email' })
  @ApiResponse({ status: 201, description: 'Newsletter queued for sending' })
  async sendNewsletter(@Body() dto: SendNewsletterDto) {
    return this.newsletterService.sendBulkEmail(dto);
  }
}
