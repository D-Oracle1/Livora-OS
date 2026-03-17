import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Dynamic form field responses as key-value pairs' })
  @IsObject()
  @IsNotEmpty()
  userData: Record<string, unknown>;
}

export class CheckInDto {
  @ApiProperty({ description: 'QR token from the scanned QR code' })
  @IsString()
  @IsNotEmpty()
  qrToken: string;
}
