import { IsEmail, IsString, IsOptional, IsNotEmpty, IsArray, IsIn, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SubscribeDto {
  @ApiProperty({ description: 'Email address to subscribe' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Subscriber name', required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class AttachmentDto {
  @ApiProperty({ description: 'Attachment filename' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'URL to the file' })
  @IsString()
  url: string;
}

export class BrandingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
}

export class SendNewsletterDto {
  @ApiProperty({ description: 'Email subject line' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Email HTML content (rich text)' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Who to send to',
    enum: ['SUBSCRIBERS', 'CLIENTS', 'STAFF', 'REALTORS', 'CUSTOM'],
  })
  @IsOptional()
  @IsIn(['SUBSCRIBERS', 'CLIENTS', 'STAFF', 'REALTORS', 'CUSTOM'])
  recipientType?: 'SUBSCRIBERS' | 'CLIENTS' | 'STAFF' | 'REALTORS' | 'CUSTOM';

  @ApiPropertyOptional({ description: 'Specific email addresses (for CUSTOM type or cherry-picking)' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  specificEmails?: string[];

  @ApiPropertyOptional({ description: 'File attachments', type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({ description: 'Company branding for the email letterhead' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;
}
