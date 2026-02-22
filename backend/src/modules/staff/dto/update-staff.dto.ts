import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, IsBoolean, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StaffPosition, EmploymentType } from '@prisma/client';

export class UpdateStaffDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: StaffPosition, description: 'Staff position in hierarchy' })
  @IsOptional()
  @IsEnum(StaffPosition)
  position?: StaffPosition;

  @ApiPropertyOptional({ description: 'Job title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: EmploymentType, description: 'Employment type' })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Manager ID (Staff Profile ID)' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Base salary' })
  @IsOptional()
  @IsNumber()
  baseSalary?: number;

  @ApiPropertyOptional({ description: 'Is active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Termination date' })
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @ApiPropertyOptional({ description: 'Annual leave balance' })
  @IsOptional()
  @IsNumber()
  annualLeaveBalance?: number;

  @ApiPropertyOptional({ description: 'Sick leave balance' })
  @IsOptional()
  @IsNumber()
  sickLeaveBalance?: number;

  @ApiPropertyOptional({ description: 'RBAC Role ID to assign (null to remove role)' })
  @IsOptional()
  @IsUUID()
  roleId?: string | null;
}
