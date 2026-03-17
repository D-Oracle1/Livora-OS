import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class UpdateEventStatusDto {
  @ApiPropertyOptional({ enum: ['draft', 'published', 'closed'] })
  @IsEnum(['draft', 'published', 'closed'])
  @IsOptional()
  status: string;
}
