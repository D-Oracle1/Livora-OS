import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';

import { DatabaseModule } from '../../database/database.module';
import { QueueModule } from '../../common/services/queue.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    NotificationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [RaffleController],
  providers: [RaffleService],
  exports: [RaffleService],
})
export class RaffleModule {}
