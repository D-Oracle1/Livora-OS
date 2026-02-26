import { Controller, Post, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';
import { RankingService } from '../ranking/ranking.service';
import { StaffRankingService } from '../ranking/staff-ranking.service';
import { ClientRankingService } from '../ranking/client-ranking.service';
import { SaleOverdueService } from '../sale/sale-overdue.service';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { TenantPrismaService } from '../../database/tenant-prisma.service';

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
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  @Get('keep-alive')
  @ApiOperation({ summary: 'Keep all Supabase projects alive — pings master DB and all active tenant DBs' })
  async keepAlive() {
    this.logger.log('Cron: keep-alive ping');

    // 1. Ping master DB
    await this.masterPrisma.$queryRaw`SELECT 1`;
    this.logger.log('Cron: master DB alive');

    // 2. Ping every active tenant DB so none of them pause on Supabase free tier
    const allCompanies = await this.masterPrisma.company.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, databaseUrl: true },
    });
    const companies = allCompanies.filter((co) => co.databaseUrl);

    const results: Record<string, string> = {};
    await Promise.allSettled(
      companies.map(async (co) => {
        try {
          const client = await this.tenantPrisma.getClient(co.id);
          await (client as any).$queryRaw`SELECT 1`;
          results[co.slug] = 'ok';
          this.logger.log(`Cron: tenant DB alive — ${co.slug}`);
        } catch (err: any) {
          results[co.slug] = `error: ${err.message}`;
          this.logger.warn(`Cron: tenant DB ping failed — ${co.slug}: ${err.message}`);
        }
      }),
    );

    return { success: true, job: 'keep-alive', master: 'ok', tenants: results, ts: new Date().toISOString() };
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
