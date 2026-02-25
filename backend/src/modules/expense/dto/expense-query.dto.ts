import { IsOptional, IsString, IsEnum, IsNumberString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpensePaymentMethod, ExpenseApprovalStatus } from '@prisma/client';

export class ExpenseQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsNumberString() page?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() limit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional({ enum: ExpensePaymentMethod }) @IsOptional() @IsEnum(ExpensePaymentMethod) paymentMethod?: ExpensePaymentMethod;
  @ApiPropertyOptional({ enum: ExpenseApprovalStatus }) @IsOptional() @IsEnum(ExpenseApprovalStatus) approvalStatus?: ExpenseApprovalStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
}
