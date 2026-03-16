import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the sender' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Matches(/^[\+\d\s\-\(\)]{7,20}$/, { message: 'Invalid phone number format' })
  phone?: string;

  @ApiProperty({ example: 'I would like to inquire about your services...', description: 'Message body' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 2000)
  message: string;
}
