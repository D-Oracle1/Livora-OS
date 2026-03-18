import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [QueueService, MailService],
  exports: [QueueService, MailService],
})
export class QueueModule {}
