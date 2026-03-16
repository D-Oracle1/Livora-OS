import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class ClockInDto {
  @ApiPropertyOptional({ description: 'Location for geolocation tracking' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'QR code token scanned from admin-generated attendance QR' })
  @IsOptional()
  @IsString()
  qrToken?: string;
}

export class ClockOutDto {
  @ApiPropertyOptional({ description: 'Notes about the work day' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAttendanceDto {
  @ApiPropertyOptional({ enum: AttendanceStatus, description: 'Attendance status' })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Clock in time' })
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @ApiPropertyOptional({ description: 'Clock out time' })
  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AttendanceQueryDto {
  page?: number;
  limit?: number;
  staffProfileId?: string;
  departmentId?: string;
  status?: AttendanceStatus;
  startDate?: string;
  endDate?: string;
}
