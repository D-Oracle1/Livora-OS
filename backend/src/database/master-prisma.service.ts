import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/master-client';

@Injectable()
export class MasterPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MasterPrismaService.name);

  constructor() {
    super({
      datasourceUrl: MasterPrismaService.buildDatasourceUrl(),
      log:
        process.env.NODE_ENV === 'production'
          ? ['warn', 'error']
          : ['info', 'warn', 'error'],
    });
  }

  /**
   * Builds the datasource URL, optimizing for serverless (Vercel) deployments.
   *
   * On Vercel, each function invocation can create a new Prisma instance. Without
   * connection limiting this exhausts Supabase's Session-mode pool very quickly.
   * Fix: switch to the Transaction-mode pooler (port 6543) and cap to 1 connection
   * per serverless instance via `connection_limit=1&pgbouncer=true`.
   */
  private static buildDatasourceUrl(): string {
    const raw = process.env.MASTER_DATABASE_URL || '';
    if (!raw || !process.env.VERCEL) return raw;

    try {
      const u = new URL(raw);

      // Switch Supabase pooler from session (5432) → transaction mode (6543)
      if (u.hostname.includes('pooler.supabase.com') && u.port === '5432') {
        u.port = '6543';
        if (!u.searchParams.has('pgbouncer')) {
          u.searchParams.set('pgbouncer', 'true');
        }
      }

      // Cap connections per serverless instance
      if (!u.searchParams.has('connection_limit')) {
        u.searchParams.set('connection_limit', '1');
      }

      return u.toString();
    } catch {
      // URL parse failed — return original unchanged
      return raw;
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Master database connected');
    } catch (error) {
      this.logger.error(`Master database connection failed: ${error.message}`);
      // Don't throw — allow app to start even if master DB is unavailable
      // Queries will fail at runtime with a clear error instead of crashing boot
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Master database disconnected');
  }
}
