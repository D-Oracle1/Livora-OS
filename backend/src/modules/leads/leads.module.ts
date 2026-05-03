import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { NotificationModule } from '../notification/notification.module';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [NotificationModule, BranchModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
