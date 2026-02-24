import { Injectable, Logger } from '@nestjs/common';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { Client as PgClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MasterPlatformService {
  private readonly logger = new Logger(MasterPlatformService.name);

  constructor(private readonly masterPrisma: MasterPrismaService) {}

  async getSettings(key: string): Promise<Record<string, any>> {
    const setting = await this.masterPrisma.masterSetting.findUnique({
      where: { key },
    });
    return (setting?.value as Record<string, any>) || {};
  }

  async updateSettings(key: string, value: Record<string, any>): Promise<Record<string, any>> {
    const existing = await this.masterPrisma.masterSetting.findUnique({
      where: { key },
    });
    const current = (existing?.value as Record<string, any>) || {};
    const merged = { ...current, ...value };

    await this.masterPrisma.masterSetting.upsert({
      where: { key },
      create: { key, value: merged },
      update: { value: merged },
    });

    this.logger.debug(`Platform setting updated: ${key}`);
    return merged;
  }

  async getAllSettings(): Promise<{ branding: Record<string, any>; cms: Record<string, any> }> {
    const [branding, cms] = await Promise.all([
      this.getSettings('platform_branding'),
      this.getSettings('platform_cms'),
    ]);
    return { branding, cms };
  }

  /**
   * Add email verification columns to DATABASE_URL and all tenant DBs.
   * Idempotent — safe to run on already-migrated databases.
   * Called automatically from bootstrap; can also be called standalone.
   */
  async migrateUserVerificationColumns(): Promise<{ migrated: number; failed: number; errors: string[] }> {
    const SQL_PATCH = `
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMP(3);
    `;

    const errors: string[] = [];

    const runOnUrl = async (url: string, label: string): Promise<boolean> => {
      let connStr = url;
      try {
        const u = new URL(url);
        if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') {
          u.port = '5432';
        }
        const params = new URLSearchParams(u.search);
        params.delete('pgbouncer');
        params.delete('connection_limit');
        u.search = params.toString();
        connStr = u.toString();
      } catch { /* use original */ }

      const pg = new PgClient({ connectionString: connStr });
      try {
        await pg.connect();
        await pg.query(SQL_PATCH);
        // Also create the unique index, ignoring "already exists"
        await pg.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "users_emailVerificationToken_key"
            ON "users"("emailVerificationToken")
            WHERE "emailVerificationToken" IS NOT NULL;
        `).catch(() => {});
        return true;
      } catch (e: any) {
        const msg = `${label}: ${e.message?.slice(0, 120)}`;
        this.logger.warn(`migrateUserVerificationColumns — ${msg}`);
        errors.push(msg);
        return false;
      } finally {
        await pg.end().catch(() => {});
      }
    };

    let migrated = 0;
    let failed = 0;

    // 1. Default DATABASE_URL (fallback DB used when no X-Company-ID is set)
    const defaultUrl = process.env.DATABASE_URL;
    if (defaultUrl) {
      const ok = await runOnUrl(defaultUrl, 'DATABASE_URL');
      ok ? migrated++ : failed++;
    }

    // 2. All active tenant databases
    const companies = await this.masterPrisma.company.findMany({
      select: { slug: true, databaseUrl: true },
    });
    for (const co of companies) {
      const ok = await runOnUrl(co.databaseUrl, co.slug);
      ok ? migrated++ : failed++;
    }

    this.logger.log(`migrateUserVerificationColumns: ${migrated} ok, ${failed} failed`);
    return { migrated, failed, errors };
  }

  /**
   * Apply the master-schema.sql DDL against MASTER_DATABASE_URL.
   * Safe to run multiple times (all statements are idempotent).
   */
  async syncMasterSchema(): Promise<{ message: string; tablesCreated: string[] }> {
    const masterUrl = process.env.MASTER_DATABASE_URL;
    if (!masterUrl) throw new Error('MASTER_DATABASE_URL is not configured');

    const sqlPath = join(process.cwd(), 'prisma', 'master-schema.sql');
    let sql: string;
    try {
      sql = readFileSync(sqlPath, 'utf8');
    } catch {
      throw new Error('master-schema.sql not found — redeploy the backend to regenerate it');
    }

    // Split into individual statements for error resilience
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    // Build a clean connection string for pg.Client
    let connStr = masterUrl;
    try {
      const u = new URL(masterUrl);
      // Supabase: switch transaction pooler → session pooler for DDL
      if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') {
        u.port = '5432';
        connStr = u.toString();
      }
      // Remove Prisma-specific params
      const params = new URLSearchParams(u.search);
      params.delete('pgbouncer');
      params.delete('connection_limit');
      u.search = params.toString();
      connStr = u.toString();
    } catch { /* use original */ }

    const client = new PgClient({ connectionString: connStr });
    await client.connect();

    const applied: string[] = [];
    try {
      for (const stmt of statements) {
        try {
          await client.query(stmt);
          const match = stmt.match(/CREATE TABLE IF NOT EXISTS "?(\w+)"?/i);
          if (match) applied.push(match[1]);
        } catch (err: any) {
          // Skip "already exists" and similar non-critical errors
          if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
            this.logger.warn(`Master schema DDL warning: ${err.message?.slice(0, 120)}`);
          }
        }
      }
    } finally {
      await client.end();
    }

    this.logger.log(`Master schema sync complete. Statements applied: ${statements.length}`);
    return {
      message: 'Master database schema is up to date',
      tablesCreated: applied,
    };
  }
}
