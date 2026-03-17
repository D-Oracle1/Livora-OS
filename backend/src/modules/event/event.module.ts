import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { EventController } from './event.controller';
import { EventService } from './event.service';
import { RegistrationService } from './registration.service';
import { QrService } from './qr.service';
import { EventAnalyticsService } from './analytics.service';

import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../common/services/cache.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: '3650d' },
      }),
    }),
  ],
  controllers: [EventController],
  providers: [EventService, RegistrationService, QrService, EventAnalyticsService],
  exports: [EventService, EventAnalyticsService],
})
export class EventModule {}
