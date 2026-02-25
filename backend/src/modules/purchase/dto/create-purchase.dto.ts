import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsInt,
  IsOptional,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ example: 'property-uuid' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 2, description: 'Number of plots to purchase' })
  @IsInt()
  @Min(1)
  numPlots: number;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @IsString()
  nin?: string;

  @ApiProperty({ example: '12 Palm Avenue, Lagos' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Jane Doe (+2348098765432)' })
  @IsString()
  @IsNotEmpty()
  nextOfKin: string;

  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @IsNotEmpty()
  occupation: string;

  @ApiPropertyOptional({ example: 'Interested in plot 5B' })
  @IsOptional()
  @IsString()
  message?: string;
}
