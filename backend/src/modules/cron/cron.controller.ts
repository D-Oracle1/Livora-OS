import { Controller, Post, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';
import { RankingService } from '../ranking/ranking.service';
import { StaffRankingService } from '../ranking/staff-ranking.service';
import { ClientRankingService } from '../ranking/client-ranking.service';
import { SaleOverdueService } from '../sale/sale-overdue.service';
import { MasterPrismaService } from '../../database/master-prisma.service';

@ApiTags('Cron')
@Controller('cron')
@UseGuards(CronSecretGuard)
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly rankingService: RankingService,
    private readonly staffRankingService: StaffRankingService,
    private readonly clientRankingService: ClientRankingService,
    private readonly saleOverdueService: SaleOverdueService,
    private readonly masterPrisma: MasterPrismaService,
  ) {}

  @Get('keep-alive')
  @ApiOperation({ summary: 'Keep Supabase project alive (runs a lightweight master DB query)' })
  async keepAlive() {
    this.logger.log('Cron: keep-alive ping');
    await this.masterPrisma.$queryRaw`SELECT 1`;
    return { success: true, job: 'keep-alive', ts: new Date().toISOString() };
  }

  @Post('rankings/daily')
  @ApiOperation({ summary: 'Trigger daily rankings update' })
  async dailyRankings() {
    this.logger.log('Cron: Daily rankings triggered');
    await this.rankingService.updateDailyRankings();
    await this.staffRankingService.updateDailyStaffRankings();
    await this.clientRankingService.updateDailyClientRankings();
    return { success: true, job: 'daily-rankings' };
  }

  @Post('rankings/monthly')
  @ApiOperation({ summary: 'Trigger monthly rankings update' })
  async monthlyRankings() {
    this.logger.log('Cron: Monthly rankings triggered');
    await this.rankingService.updateMonthlyRankings();
    await this.staffRankingService.updateMonthlyStaffRankings();
    await this.clientRankingService.updateMonthlyClientRankings();
    return { success: true, job: 'monthly-rankings' };
  }

  @Post('rankings/yearly')
  @ApiOperation({ summary: 'Trigger yearly rankings update' })
  async yearlyRankings() {
    this.logger.log('Cron: Yearly rankings triggered');
    await this.rankingService.updateYearlyRankings();
    await this.staffRankingService.updateYearlyStaffRankings();
    await this.clientRankingService.updateYearlyClientRankings();
    return { success: true, job: 'yearly-rankings' };
  }

  @Post('overdue-payments')
  @ApiOperation({ summary: 'Trigger overdue payment check' })
  async overduePayments() {
    this.logger.log('Cron: Overdue payments check triggered');
    await this.saleOverdueService.checkOverduePayments();
    return { success: true, job: 'overdue-payments' };
  }
}
