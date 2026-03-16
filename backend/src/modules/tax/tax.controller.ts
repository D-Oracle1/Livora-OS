import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tax')
@Controller('taxes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get all tax records' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'realtorId', required: false, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'quarter', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of tax records' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('realtorId') realtorId?: string,
    @Query('year') year?: number,
    @Query('quarter') quarter?: number,
  ) {
    return this.taxService.findAll({ page, limit, realtorId, year, quarter });
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get tax statistics' })
  @ApiQuery({ name: 'realtorId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Tax statistics' })
  async getStats(@Query('realtorId') realtorId?: string) {
    return this.taxService.getStats(realtorId);
  }

  @Get('report/:realtorId')
  @ApiOperation({ summary: 'Get realtor tax report' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Realtor tax report' })
  async getRealtorTaxReport(
    @Param('realtorId') realtorId: string,
    @Query('year') year?: number,
  ) {
    return this.taxService.getRealtorTaxReport(realtorId, year);
  }

  @Post('recalculate')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Recalculate all tax records using the current tax rate from settings' })
  @ApiResponse({ status: 200, description: 'Number of tax records updated/created' })
  async recalculate() {
    return this.taxService.updateAllTaxRecords();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tax record by ID' })
  @ApiResponse({ status: 200, description: 'Tax record details' })
  async findOne(@Param('id') id: string) {
    return this.taxService.findById(id);
  }
}
