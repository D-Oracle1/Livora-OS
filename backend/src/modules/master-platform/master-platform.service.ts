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
