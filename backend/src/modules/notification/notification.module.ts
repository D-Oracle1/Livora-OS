import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SmsService } from '../../common/services/sms.service';
import { PushNotificationService } from '../../common/services/push-notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, SmsService, PushNotificationService],
  exports: [NotificationService, SmsService],
})
export class NotificationModule {}
