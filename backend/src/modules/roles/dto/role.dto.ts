import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PermissionDto {
  @ApiProperty({ description: 'Resource name, e.g. "sales", "properties"' })
  @IsString()
  resource: string;

  @ApiProperty({ description: 'Action, e.g. "read", "write", "delete", "manage"' })
  @IsString()
  action: string;

  @ApiPropertyOptional({ description: 'Scope, e.g. "all", "own_department"' })
  @IsOptional()
  @IsString()
  scope?: string;
}

export class CreateRoleDto {
  @ApiProperty({ description: 'Role name (unique)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Permissions granted by this role', type: [PermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Role name (unique)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Permissions granted by this role', type: [PermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
