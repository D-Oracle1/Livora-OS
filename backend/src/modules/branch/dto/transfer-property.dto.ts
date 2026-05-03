import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferPropertyDto {
  @ApiProperty({ description: 'Target branch ID to transfer the property to' })
  @IsString()
  toBranchId: string;

  @ApiPropertyOptional({ description: 'Reason for the transfer' })
  @IsOptional()
  @IsString()
  reason?: string;
}
