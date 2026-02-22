import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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
      // Keep port 5432 (session pooler) — do NOT switch to 6543 (transaction pooler)
      // Just cap the connection count so we don't exhaust Supabase limits
      if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '1');
      // Remove pgbouncer flag if present — it disables features we need for DDL
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

    // Supabase does NOT allow CREATE DATABASE from SQL, and running the Prisma
    // CLI in Vercel serverless is impossible (WASM files not bundled).
    // Instead we use schema-based isolation: each tenant gets its own PostgreSQL
    // schema in the shared database, then apply DDL directly via raw SQL.
    const masterUrl = process.env.MASTER_DATABASE_URL || '';
    if (!masterUrl) throw new Error('MASTER_DATABASE_URL is not set');

    // Build tenant URL — same host/db, different schema.
    // IMPORTANT: use the session-pooler URL (forDDL) for provisioning.
    // Transaction-pooler (pgbouncer port 6543) cannot run DDL reliably because:
    //  - search_path doesn't persist across statements
    //  - ALTER TYPE ADD VALUE is not allowed inside pgbouncer transaction mode
    const urlObj = new URL(masterUrl);
    const params = new URLSearchParams(urlObj.search || '');
    params.set('schema', schemaName);
    const tenantUrlRaw =
      `${urlObj.protocol}//${urlObj.username}:${urlObj.password}` +
      `@${urlObj.hostname}:${urlObj.port}${urlObj.pathname}?${params.toString()}`;

    // Use session-mode URLs for DDL (NOT withConnectionLimit which switches to pgBouncer tx mode)
    const adminDDLUrl = TenantPrismaService.forDDL(masterUrl);
    const tenantDDLUrl = TenantPrismaService.forDDL(tenantUrlRaw);

    // Step 1: create the PostgreSQL schema via a raw connection to master DB
    const adminClient = new PrismaClient({ datasourceUrl: adminDDLUrl, log: ['error'] });
    try {
      await adminClient.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
      );
      this.logger.log(`Schema created: ${schemaName}`);
    } catch (error: any) {
      this.logger.warn(`Schema creation note (${schemaName}): ${error.message}`);
    } finally {
      await adminClient.$disconnect();
    }

    // Step 2: apply the pre-generated DDL SQL into the new tenant schema.
    const sqlPath = join(process.cwd(), 'prisma', 'tenant-schema.sql');
    let sql: string;
    try {
      sql = readFileSync(sqlPath, 'utf8');
    } catch {
      throw new Error(`tenant-schema.sql not found at ${sqlPath}`);
    }

    // Parse statements: split on semicolon+newline, strip leading comment blocks.
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => {
        const lines = s.split('\n');
        const firstSql = lines.findIndex((l) => l.trim() && !l.trim().startsWith('--'));
        return firstSql >= 0 ? lines.slice(firstSql).join('\n').trim() : '';
      })
      .filter((s) => s.length > 0);

    // Use a session-mode client for DDL execution so that:
    //  1. The connection is reused across all statements (no reconnect overhead)
    //  2. search_path persists (required for schema-aware DDL)
    const tenantClient = new PrismaClient({ datasourceUrl: tenantDDLUrl, log: ['error'] });
    try {
      // Batch "safe" statements that can run in a single transaction, and run
      // "unsafe" statements (ALTER TYPE ADD VALUE, which can't run inside a
      // transaction in PostgreSQL) individually.
      const txBatch: string[] = [];

      const flushBatch = async () => {
        if (txBatch.length === 0) return;
        // Run the batch inside a transaction to reuse a single round-trip
        try {
          await tenantClient.$transaction(
            txBatch.map((stmt) => tenantClient.$executeRawUnsafe(stmt)),
          );
        } catch {
          // If the batch fails (e.g. some "already exists"), fall back to per-statement
          for (const stmt of txBatch) {
            try {
              await tenantClient.$executeRawUnsafe(stmt);
            } catch (err: any) {
              const msg: string = err.message || '';
              if (this.isIdempotentError(msg, err.code, err.meta)) continue;
              this.logger.warn(`DDL warning (${schemaName}): ${msg.slice(0, 120)}`);
            }
          }
        }
        txBatch.length = 0;
      };

      for (const stmt of statements) {
        // ALTER TYPE ADD VALUE cannot run inside a PostgreSQL transaction
        const needsOwnConnection = /ALTER\s+TYPE\s+.+\s+ADD\s+VALUE/i.test(stmt);

        if (needsOwnConnection) {
          // Flush any pending batch first
          await flushBatch();
          // Execute alone (outside transaction)
          try {
            await tenantClient.$executeRawUnsafe(stmt);
          } catch (err: any) {
            const msg: string = err.message || '';
            if (!this.isIdempotentError(msg, err.code, err.meta)) {
              this.logger.warn(`DDL warning (${schemaName}): ${msg.slice(0, 120)}`);
            }
          }
        } else {
          txBatch.push(stmt);
          // Flush in chunks of 20 to keep transaction size reasonable
          if (txBatch.length >= 20) await flushBatch();
        }
      }

      // Flush any remaining statements
      await flushBatch();

      this.logger.log(`Tenant schema provisioned: ${schemaName} (${statements.length} statements)`);
    } finally {
      await tenantClient.$disconnect();
    }

    // Return the query-optimised URL (transaction pooler for Vercel) as stored URL
    return TenantPrismaService.withConnectionLimit(tenantUrlRaw);
  }

  private isIdempotentError(msg: string, code?: string, meta?: any): boolean {
    return (
      msg.includes('already exists') ||
      msg.includes('does not exist') ||
      msg.includes('duplicate_object') ||
      (code === 'P2010' && (meta?.code === '42710' || meta?.code === '42704'))
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
