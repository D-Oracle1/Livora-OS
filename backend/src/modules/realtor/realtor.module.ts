import { Module, forwardRef } from '@nestjs/common';
import { RealtorService } from './realtor.service';
import { RealtorController } from './realtor.controller';
import { NotificationModule } from '../notification/notification.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { RankingModule } from '../ranking/ranking.module';
import { BulkImportModule } from '../upload/bulk-import.module';

@Module({
  imports: [
    forwardRef(() => NotificationModule),
    forwardRef(() => LoyaltyModule),
    forwardRef(() => RankingModule),
    BulkImportModule,
  ],
  controllers: [RealtorController],
  providers: [RealtorService],
  exports: [RealtorService],
})
export class RealtorModule {}
