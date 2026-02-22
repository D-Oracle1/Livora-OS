import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PerformanceService } from '../services/performance.service';
import { CreateReviewDto, UpdateReviewDto, AcknowledgeReviewDto } from '../dto/performance.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ReviewCycle, ReviewStatus } from '@prisma/client';

@ApiTags('HR - Performance')
@Controller('hr/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Create a performance review' })
  create(@CurrentUser('id') reviewerId: string, @Body() dto: CreateReviewDto) {
    return this.performanceService.create(reviewerId, dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all performance reviews' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'revieweeId', required: false })
  @ApiQuery({ name: 'reviewerId', required: false })
  @ApiQuery({ name: 'cycle', required: false, enum: ReviewCycle })
  @ApiQuery({ name: 'status', required: false, enum: ReviewStatus })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('revieweeId') revieweeId?: string,
    @Query('reviewerId') reviewerId?: string,
    @Query('cycle') cycle?: ReviewCycle,
    @Query('status') status?: ReviewStatus,
  ) {
    return this.performanceService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      revieweeId,
      reviewerId,
      cycle,
      status,
    });
  }

  @Get('my')
  @Roles('STAFF')
  @ApiOperation({ summary: 'Get my performance reviews' })
  getMyReviews(@CurrentUser('id') userId: string) {
    return this.performanceService.getMyReviews(userId);
  }

  @Get('to-give')
  @Roles('STAFF')
  @ApiOperation({ summary: 'Get reviews I need to give' })
  getReviewsToGive(@CurrentUser('id') userId: string) {
    return this.performanceService.getReviewsToGive(userId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Get performance review by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.performanceService.findById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Update performance review' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewDto) {
    return this.performanceService.update(id, dto);
  }

  @Post(':id/submit')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR', 'STAFF')
  @ApiOperation({ summary: 'Submit performance review' })
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.performanceService.submit(id);
  }

  @Post(':id/acknowledge')
  @Roles('STAFF')
  @ApiOperation({ summary: 'Acknowledge performance review' })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AcknowledgeReviewDto,
  ) {
    return this.performanceService.acknowledge(id, userId, dto);
  }
}
