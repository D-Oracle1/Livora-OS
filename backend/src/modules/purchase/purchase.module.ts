import { Module, forwardRef } from '@nestjs/common';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';
import { NotificationModule } from '../notification/notification.module';
import { MailService } from '../../common/services/mail.service';

@Module({
  imports: [forwardRef(() => NotificationModule)],
  controllers: [PurchaseController],
  providers: [PurchaseService, MailService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
