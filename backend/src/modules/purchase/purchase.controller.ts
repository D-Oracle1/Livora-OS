import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Purchases')
@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit a property purchase enquiry' })
  @ApiResponse({ status: 201, description: 'Enquiry created' })
  async create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchaseService.create(dto, userId);
  }

  @Post(':id/payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark payment as submitted for an enquiry' })
  @ApiResponse({ status: 200, description: 'Payment submitted, admin notified' })
  async submitPayment(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchaseService.submitPayment(id, userId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my purchase enquiries' })
  @ApiResponse({ status: 200, description: 'List of own enquiries' })
  async findMy(@CurrentUser('id') userId: string) {
    return this.purchaseService.findMyEnquiries(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GENERAL_OVERSEER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all purchase enquiries (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Paginated enquiries' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.purchaseService.findAll({ page, limit, status });
  }
}
