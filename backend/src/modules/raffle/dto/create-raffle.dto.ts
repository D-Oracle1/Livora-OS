import { IsString, IsOptional, IsArray, IsInt, IsDateString, Min, Max, MinLength } from 'class-validator';

export class CreateRaffleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  codePrefix: string;

  @IsInt()
  @Min(4)
  @Max(12)
  @IsOptional()
  codeLength?: number;

  @IsArray()
  @IsString({ each: true })
  targetRoles: string[];

  @IsDateString()
  @IsOptional()
  joinedAfter?: string;

  @IsDateString()
  @IsOptional()
  joinedBefore?: string;
}
