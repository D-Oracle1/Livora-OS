import { Module, forwardRef } from '@nestjs/common';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { PerformanceService } from './services/performance.service';
import { PayrollService } from './services/payroll.service';
import { PolicyService } from './services/policy.service';
import { SalaryConfigService } from './services/salary-config.service';
import { AttendanceController } from './controllers/attendance.controller';
import { LeaveController } from './controllers/leave.controller';
import { PerformanceController } from './controllers/performance.controller';
import { PayrollController } from './controllers/payroll.controller';
import { PolicyController } from './controllers/policy.controller';
import { SalaryConfigController } from './controllers/salary-config.controller';
import { NotificationModule } from '../notification/notification.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    forwardRef(() => NotificationModule),
    SettingsModule,
  ],
  controllers: [
    AttendanceController,
    LeaveController,
    PerformanceController,
    PayrollController,
    PolicyController,
    SalaryConfigController,
  ],
  providers: [
    AttendanceService,
    LeaveService,
    PerformanceService,
    PayrollService,
    PolicyService,
    SalaryConfigService,
  ],
  exports: [
    AttendanceService,
    LeaveService,
    PerformanceService,
    PayrollService,
    PolicyService,
    SalaryConfigService,
  ],
})
export class HrModule {}
