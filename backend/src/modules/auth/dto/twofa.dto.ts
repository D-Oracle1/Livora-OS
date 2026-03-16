import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFaDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class VerifyTwoFaDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class DisableTwoFaDto {
  @ApiProperty({ description: '6-digit TOTP code to confirm disable' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class RecoveryCodeDto {
  @ApiProperty({ description: '8-character recovery code' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 10)
  recoveryCode: string;
}
