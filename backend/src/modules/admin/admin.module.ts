import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SetupController } from './setup.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, SetupController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
