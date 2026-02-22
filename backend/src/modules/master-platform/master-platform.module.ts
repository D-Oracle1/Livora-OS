import { Module } from '@nestjs/common';
import { MasterPlatformService } from './master-platform.service';
import { MasterPlatformController } from './master-platform.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MasterPlatformController],
  providers: [MasterPlatformService],
  exports: [MasterPlatformService],
})
export class MasterPlatformModule {}
