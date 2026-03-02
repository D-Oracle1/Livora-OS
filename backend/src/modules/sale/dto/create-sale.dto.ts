import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEmail, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';

export class CreateSaleDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  clientName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  clientEmail: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  clientContact?: string;

  @ApiProperty({ example: 'property-uuid' })
  @IsString()
  propertyId: string;

  @ApiProperty({ example: 850000 })
  @IsNumber()
  @Min(0)
  saleValue: number;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  saleDate: string;

  @ApiPropertyOptional({ example: 'First-time buyer, smooth transaction' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['FULL', 'INSTALLMENT'], default: 'FULL' })
  @IsOptional()
  @IsEnum(['FULL', 'INSTALLMENT'])
  paymentPlan?: 'FULL' | 'INSTALLMENT';

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  numberOfInstallments?: number;

  @ApiPropertyOptional({ example: 250000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  firstPaymentAmount?: number;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 500, description: 'Area sold in sqm (deducted from property)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaSold?: number;

  @ApiPropertyOptional({ example: 'realtor-profile-uuid', description: 'Required when submitted by sales-dept staff; ignored for realtors' })
  @IsOptional()
  @IsString()
  realtorId?: string;
}
