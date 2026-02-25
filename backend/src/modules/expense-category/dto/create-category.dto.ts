import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategoryType } from '@prisma/client';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: ExpenseCategoryType, default: ExpenseCategoryType.OTHER })
  @IsOptional()
  @IsEnum(ExpenseCategoryType)
  type?: ExpenseCategoryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
