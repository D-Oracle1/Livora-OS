import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Client as PgClient } from 'pg';
import { MasterPrismaService } from './master-prisma.service';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TenantClient {
  client: PrismaClient;
  lastUsed: number;
}

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);
  private readonly clients = new Map<string, TenantClient>();
  private readonly MAX_POOL_SIZE = process.env.VERCEL ? 5 : 50;
  private readonly IDLE_TIMEOUT_MS = process.env.VERCEL
    ? 5 * 60 * 1000   // 5 minutes in serverless
    : 30 * 60 * 1000; // 30 minutes in long-running server
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Appends `connection_limit=1&pgbouncer=true` for serverless deployments
   * and switches Supabase pooler URLs from session (5432) → transaction (6543).
   *
   * NOT used for DDL/provisioning — DDL requires a session-mode connection.
   */
  static withConnectionLimit(url: string): string {
    if (!url || !process.env.VERCEL) return url;
    try {
      const u = new URL(url);
      if (u.hostname.includes('pooler.supabase.com') && u.port === '5432') {
        u.port = '6543';
        if (!u.searchParams.has('pgbouncer')) u.searchParams.set('pgbouncer', 'true');
      }
      if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '1');
      return u.toString();
    } catch {
      return url;
    }
  }

  /**
   * Returns the URL suitable for DDL (schema provisioning).
   * Uses the session pooler (port 5432) or direct URL so that:
   *  - SET search_path persists across statements in the same connection
   *  - ALTER TYPE ADD VALUE works (not allowed inside transaction-pooler sessions)
   *  - Multiple sequential statements reuse the same connection (faster)
   *
   * On Vercel we cap to 1 connection but intentionally keep session mode (5432).
   */
  static forDDL(url: string): string {
    if (!url) return url;
    try {
      const u = new URL(url);
      // Switch from transaction pooler (6543) to session pooler (5432) for DDL.
      // pgBouncer transaction mode resets search_path on every transaction which
      // breaks schema-qualified DDL. Session pooler (5432) keeps the connection alive.
      if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') {
        u.port = '5432';
      }
      if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '1');
      u.searchParams.delete('pgbouncer');
      return u.toString();
    } catch {
      return url;
    }
  }

  constructor(private readonly masterPrisma: MasterPrismaService) {
    // Periodically evict idle connections (skip in serverless — no persistent timers)
    if (!process.env.VERCEL) {
      this.cleanupInterval = setInterval(() => this.evictIdleClients(), 5 * 60 * 1000);
    }
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    const disconnectPromises = Array.from(this.clients.values()).map((tc) =>
      tc.client.$disconnect().catch(() => {}),
    );
    await Promise.all(disconnectPromises);
    this.clients.clear();
    this.logger.log('All tenant connections closed');
  }

  async getClient(companyId: string): Promise<PrismaClient> {
    // Return cached client if available
    const existing = this.clients.get(companyId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    // Look up company's database URL from master DB
    const company = await this.masterPrisma.company.findUnique({
      where: { id: companyId },
      select: { databaseUrl: true, isActive: true, slug: true },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    if (!company.isActive) {
      throw new Error(`Company ${companyId} is inactive`);
    }

    // Evict oldest if pool is full
    if (this.clients.size >= this.MAX_POOL_SIZE) {
      await this.evictOldestClient();
    }

    // Create new client for this tenant (query traffic — use transaction pooler on Vercel)
    const client = new PrismaClient({
      datasourceUrl: TenantPrismaService.withConnectionLimit(company.databaseUrl),
      log: ['warn', 'error'],
    });

    await client.$connect();
    this.clients.set(companyId, { client, lastUsed: Date.now() });
    this.logger.log(`Tenant DB connected: ${company.slug}`);

    return client;
  }

  async getClientByDomain(domain: string): Promise<{ client: PrismaClient; companyId: string } | null> {
    const company = await this.masterPrisma.company.findUnique({
      where: { domain },
      select: { id: true, isActive: true },
    });

    if (!company || !company.isActive) return null;

    const client = await this.getClient(company.id);
    return { client, companyId: company.id };
  }

  async provisionDatabase(slug: string): Promise<string> {
    const schemaName = `tenant_${slug.replace(/[^a-z0-9_]/g, '_')}`;

    const masterUrl = process.env.MASTER_DATABASE_URL || '';
    if (!masterUrl) throw new Error('MASTER_DATABASE_URL is not set');

    // Build the tenant Prisma URL (stored for query traffic — uses transaction pooler on Vercel)
    const urlObj = new URL(masterUrl);
    const params = new URLSearchParams(urlObj.search || '');
    params.set('schema', schemaName);
    const tenantUrlRaw =
      `${urlObj.protocol}//${urlObj.username}:${urlObj.password}` +
      `@${urlObj.hostname}:${urlObj.port}${urlObj.pathname}?${params.toString()}`;

    // DDL URL: session pooler (port 5432), connection_limit=1, no pgbouncer flag.
    // pg.Client uses the native libpq simple-query protocol which supports
    // multi-statement strings — all DDL runs in ONE round trip.
    const ddlConnStr = TenantPrismaService.pgConnString(masterUrl);

    // Step 1: create the PostgreSQL schema
    const adminPg = new PgClient({ connectionString: ddlConnStr });
    await adminPg.connect();
    try {
      await adminPg.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      this.logger.log(`Schema created: ${schemaName}`);
    } catch (error: any) {
      this.logger.warn(`Schema creation note (${schemaName}): ${error.message}`);
    } finally {
      await adminPg.end();
    }

    // Step 2: apply the full DDL into the tenant schema.
    const sqlPath = join(process.cwd(), 'prisma', 'tenant-schema.sql');
    let sql: string;
    try {
      sql = readFileSync(sqlPath, 'utf8');
    } catch {
      throw new Error(`tenant-schema.sql not found at ${sqlPath}`);
    }

    const tenantPg = new PgClient({ connectionString: ddlConnStr });
    await tenantPg.connect();
    try {
      // Pin the search_path so all DDL lands in the right schema.
      await tenantPg.query(`SET search_path TO "${schemaName}"`);

      // Fast path: send the ENTIRE SQL file as one multi-statement query.
      // pg uses PostgreSQL's simple-query protocol which handles multiple
      // semicolon-separated statements server-side in a single round trip
      // (including ALTER TYPE ADD VALUE in auto-commit mode).
      try {
        await tenantPg.query(sql);
        this.logger.log(`Tenant schema provisioned (bulk): ${schemaName}`);
      } catch (bulkErr: any) {
        // Slow path: some objects already exist (re-provisioning).
        // Re-pin search_path (connection is still valid after a non-transaction error)
        // then execute statements one-by-one, skipping idempotent errors.
        this.logger.warn(
          `Bulk DDL failed (${bulkErr.message?.slice(0, 80)}), switching to per-statement`,
        );
        await tenantPg.query(`SET search_path TO "${schemaName}"`).catch(() => {});
        await this.applyStatementsWithPg(tenantPg, sql, schemaName);
      }
    } finally {
      await tenantPg.end();
    }

    return TenantPrismaService.withConnectionLimit(tenantUrlRaw);
  }

  /**
   * Builds a clean connection string for pg.Client (strips Prisma-only params,
   * switches Supabase pooler to session mode for DDL safety).
   */
  static pgConnString(url: string): string {
    if (!url) return url;
    try {
      const u = new URL(url);
      // Supabase: switch transaction pooler → session pooler
      if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') {
        u.port = '5432';
      }
      // Remove Prisma-specific params that pg doesn't understand
      u.searchParams.delete('schema');
      u.searchParams.delete('pgbouncer');
      u.searchParams.delete('connection_limit');
      return u.toString();
    } catch {
      return url;
    }
  }

  private async applyStatementsWithPg(
    client: PgClient,
    sql: string,
    schemaName: string,
  ): Promise<void> {
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => {
        const lines = s.split('\n');
        const firstSql = lines.findIndex((l) => l.trim() && !l.trim().startsWith('--'));
        return firstSql >= 0 ? lines.slice(firstSql).join('\n').trim() : '';
      })
      .filter((s) => s.length > 0);

    let warned = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err: any) {
        const msg: string = err.message || '';
        if (!this.isIdempotentError(msg, err.code)) {
          if (warned++ < 10) {
            this.logger.warn(`DDL warning (${schemaName}): ${msg.slice(0, 120)}`);
          }
        }
      }
    }
    this.logger.log(`Tenant schema provisioned (per-stmt): ${schemaName} (${statements.length} stmts)`);
  }

  private isIdempotentError(msg: string, code?: string): boolean {
    return (
      msg.includes('already exists') ||
      msg.includes('does not exist') ||
      msg.includes('duplicate_object') ||
      code === '42710' || // duplicate_object
      code === '42704'    // undefined_object
    );
  }

  async disconnectTenant(companyId: string): Promise<void> {
    const existing = this.clients.get(companyId);
    if (existing) {
      await existing.client.$disconnect();
      this.clients.delete(companyId);
    }
  }

  private async evictIdleClients(): Promise<void> {
    const now = Date.now();
    for (const [id, tc] of this.clients.entries()) {
      if (now - tc.lastUsed > this.IDLE_TIMEOUT_MS) {
        await tc.client.$disconnect().catch(() => {});
        this.clients.delete(id);
        this.logger.debug(`Evicted idle tenant connection: ${id}`);
      }
    }
  }

  private async evictOldestClient(): Promise<void> {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, tc] of this.clients.entries()) {
      if (tc.lastUsed < oldestTime) {
        oldestTime = tc.lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      const tc = this.clients.get(oldestId);
      if (tc) {
        await tc.client.$disconnect().catch(() => {});
        this.clients.delete(oldestId);
        this.logger.debug(`Evicted oldest tenant connection: ${oldestId}`);
      }
    }
  }
}
