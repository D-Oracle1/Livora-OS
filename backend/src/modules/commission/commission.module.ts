import { Module } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { CommissionController } from './commission.controller';
import { SettingsModule } from '../settings/settings.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [SettingsModule, NotificationModule],
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
