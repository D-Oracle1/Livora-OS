import { IsString, IsEmail, IsEnum, IsOptional, IsNumber, IsDateString, MinLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffPosition, EmploymentType } from '@prisma/client';


export class CreateStaffDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'First name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: StaffPosition, description: 'Staff position in hierarchy' })
  @IsEnum(StaffPosition)
  position: StaffPosition;

  @ApiProperty({ description: 'Job title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: EmploymentType, description: 'Employment type' })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiProperty({ description: 'Hire date' })
  @IsDateString()
  hireDate: string;

  @ApiProperty({ description: 'Department ID' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ description: 'Manager ID (Staff Profile ID)' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty({ description: 'Base salary' })
  @IsNumber()
  baseSalary: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'RBAC Role ID to assign to this staff member' })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
