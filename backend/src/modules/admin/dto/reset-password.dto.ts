import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class AdminResetPasswordDto {
  @ApiPropertyOptional({
    example: 'NewSecure@123',
    description: 'New password to set. If omitted, a random password is generated.',
    minLength: 8,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword?: string;
}
