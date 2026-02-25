import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  Min,
} from 'class-validator';
import { PropertyType, PropertyStatus } from '@prisma/client';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Beautiful Family Home' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Spacious 4-bedroom home with modern amenities' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PropertyType, example: PropertyType.RESIDENTIAL })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiPropertyOptional({ enum: PropertyStatus, example: PropertyStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Los Angeles' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'California' })
  @IsString()
  state: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 34.0522 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -118.2437 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ example: 850000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 50000, description: 'Price per square meter (for land)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerSqm?: number;

  @ApiPropertyOptional({ example: 5, description: 'Number of plots (for land)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  numberOfPlots?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  bedrooms?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0)
  area: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  lotSize?: number;

  @ApiPropertyOptional({ example: 2010 })
  @IsOptional()
  @IsNumber()
  yearBuilt?: number;

  @ApiPropertyOptional({ example: ['Pool', 'Garage', 'Garden'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: ['https://example.com/image1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ example: 'https://example.com/virtual-tour' })
  @IsOptional()
  @IsString()
  virtualTourUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isListed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  realtorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
