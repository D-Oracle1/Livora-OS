import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER, UserRole.STAFF, UserRole.HR)
  findAll(@Query() query: ExpenseQueryDto) {
    return this.service.findAll(query);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER)
  getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getStats(startDate, endDate);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER, UserRole.STAFF, UserRole.HR)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER, UserRole.STAFF, UserRole.HR)
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER, UserRole.STAFF, UserRole.HR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER)
  approve(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.approve(id, adminId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER)
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.reject(id, reason ?? 'No reason provided', adminId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_OVERSEER)
  softDelete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.softDelete(id, userId);
  }
}
