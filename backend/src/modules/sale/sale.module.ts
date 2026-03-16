import { Module, forwardRef } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleOverdueService } from './sale-overdue.service';
import { SaleController } from './sale.controller';
import { CommissionModule } from '../commission/commission.module';
import { TaxModule } from '../tax/tax.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationModule } from '../notification/notification.module';
import { ClientModule } from '../client/client.module';
import { SettingsModule } from '../settings/settings.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    forwardRef(() => CommissionModule),
    forwardRef(() => TaxModule),
    forwardRef(() => LoyaltyModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => ClientModule),
    SettingsModule,
    AccountingModule,
  ],
  controllers: [SaleController],
  providers: [SaleService, SaleOverdueService],
  exports: [SaleService, SaleOverdueService],
})
export class SaleModule {}
