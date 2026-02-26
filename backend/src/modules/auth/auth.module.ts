import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { CompanyModule } from '../company/company.module';
import { MailService } from '../../common/services/mail.service';

@Module({
  imports: [
    UsersModule,
    CompanyModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const rawExpiry =
          configService.get<string>('jwt.expiresIn') ||
          process.env.JWT_EXPIRES_IN ||
          '7d';

        // jsonwebtoken accepts a plain integer (seconds) or an ms-style string like
        // "7d", "24h", "30m", "60s". Anything else (e.g. "undefined", "null",
        // milliseconds like "604800000") throws at sign-time. Validate and fall back.
        const isValidExpiry = (v: string) =>
          /^\d+$/.test(v) || /^\d+\s*(s|m|h|d|w|y)$/i.test(v);

        const expiresIn = isValidExpiry(rawExpiry) ? rawExpiry : '7d';

        return {
          secret: configService.get<string>('jwt.secret') || process.env.JWT_SECRET || 'rms-secret',
          signOptions: { expiresIn },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, MailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
