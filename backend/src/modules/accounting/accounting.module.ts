import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { LedgerService } from './ledger.service';
import { DatabaseModule } from '../../database/database.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [AccountingController],
  providers: [AccountingService, LedgerService],
  exports: [AccountingService, LedgerService],
})
export class AccountingModule {}
