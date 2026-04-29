import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiPropertyOptional() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() campaignName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() formId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adAccountId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() keyword?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adGroupName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() costPerLead?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() adSpend?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() utmSource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmMedium?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmCampaign?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmTerm?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmContent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() customFields?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() rawPayload?: Record<string, any>;
}
