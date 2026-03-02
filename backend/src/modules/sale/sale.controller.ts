import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateSaleStatusDto } from './dto/update-sale-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SaleController {
  constructor(
    private readonly saleService: SaleService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('REALTOR', 'STAFF')
  @ApiOperation({ summary: 'Record a new sale' })
  @ApiResponse({ status: 201, description: 'Sale recorded successfully' })
  async create(
    @Body() createSaleDto: CreateSaleDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    if (role === 'STAFF') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId },
        include: { department: true },
      });
      if (!staffProfile || !staffProfile.department.name.toLowerCase().includes('sales')) {
        throw new ForbiddenException('Only sales department staff can report sales');
      }
      // realtorId absent → company sale; no error needed
    }
    return this.saleService.create(createSaleDto, userId, role);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sales' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'realtorId', required: false, type: String })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: SaleStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of sales' })
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('realtorId') realtorId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: SaleStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Auto-scope to realtor's own data
    if (role === 'REALTOR' && !realtorId) {
      const realtor = await this.prisma.realtorProfile.findUnique({ where: { userId } });
      if (realtor) realtorId = realtor.id;
    }
    const parsedPage = page !== undefined && !isNaN(Number(page)) ? Number(page) : undefined;
    const parsedLimit = limit !== undefined && !isNaN(Number(limit)) ? Number(limit) : undefined;
    return this.saleService.findAll({
      page: parsedPage,
      limit: parsedLimit,
      realtorId,
      clientId,
      status,
      startDate,
      endDate,
    });
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get sales statistics' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  @ApiResponse({ status: 200, description: 'Sales statistics' })
  async getStats(@Query('period') period?: 'week' | 'month' | 'quarter' | 'year') {
    return this.saleService.getStats(period);
  }

  @Post(':id/payments')
  @Roles('REALTOR', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Record an installment payment for a sale' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  async recordPayment(
    @Param('id') id: string,
    @Body() recordPaymentDto: RecordPaymentDto,
  ) {
    return this.saleService.recordPayment(id, recordPaymentDto);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Get payment history for a sale' })
  @ApiResponse({ status: 200, description: 'Payment history' })
  async getPayments(@Param('id') id: string) {
    return this.saleService.getPayments(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by ID' })
  @ApiResponse({ status: 200, description: 'Sale details' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async findOne(@Param('id') id: string) {
    return this.saleService.findById(id);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update sale status (confirm or cancel pending orders)' })
  @ApiResponse({ status: 200, description: 'Sale status updated' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateSaleStatusDto: UpdateSaleStatusDto,
  ) {
    return this.saleService.updateStatus(
      id,
      updateSaleStatusDto.status,
      updateSaleStatusDto.notes,
    );
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Approve a pending sale report' })
  @ApiResponse({ status: 200, description: 'Sale approved successfully' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async approveSale(@Param('id') id: string) {
    return this.saleService.approveSale(id);
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reject a pending sale report' })
  @ApiResponse({ status: 200, description: 'Sale rejected' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async rejectSale(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.saleService.rejectSale(id, body?.reason);
  }
}
