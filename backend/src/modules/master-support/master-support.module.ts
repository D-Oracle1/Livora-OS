import { Module } from '@nestjs/common';
import { MasterSupportService } from './master-support.service';
import { MasterSupportController } from './master-support.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MasterSupportController],
  providers: [MasterSupportService],
})
export class MasterSupportModule {}
