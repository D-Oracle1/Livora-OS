import { Module, forwardRef } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { NotificationModule } from '../notification/notification.module';
import { BulkImportModule } from '../upload/bulk-import.module';

@Module({
  imports: [
    forwardRef(() => NotificationModule),
    BulkImportModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
