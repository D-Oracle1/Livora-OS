import { Global, Module, Scope, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from './prisma.service';
import { MasterPrismaService } from './master-prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

// Cached singleton fallback — reused across all requests without a tenant
let cachedFallback: PrismaService | null = null;
let fallbackInitPromise: Promise<PrismaService> | null = null;

async function getFallbackPrisma(): Promise<PrismaService> {
  if (cachedFallback) return cachedFallback;

  // Prevent multiple concurrent initializations
  if (!fallbackInitPromise) {
    fallbackInitPromise = (async () => {
      const fallback = new PrismaService();
      // Do NOT call $connect() here. Prisma connects lazily on the first query.
      // Eager $connect() throws if DATABASE_URL is unavailable, which kills NestJS
      // DI for the entire request before any service try/catch can handle it (→ 500).
      // Lazy connection means failures surface at query-time and are caught normally.
      cachedFallback = fallback;
      return fallback;
    })();
  }

  return fallbackInitPromise;
}

@Global()
@Module({
  providers: [
    // Master DB — always connected, singleton
    MasterPrismaService,

    // Tenant connection pool — singleton that manages per-tenant clients
    TenantPrismaService,

    // Request-scoped PrismaService — resolves to the correct tenant DB per request
    {
      provide: PrismaService,
      scope: Scope.REQUEST,
      useFactory: async (
        tenantPrisma: TenantPrismaService,
        request: Request,
      ): Promise<PrismaService> => {
        const companyId = request?.tenant?.companyId;

        if (!companyId) {
          // SUPER_ADMIN on master domain or public route with no tenant
          // Return a cached default PrismaService connected to DATABASE_URL
          return getFallbackPrisma();
        }

        // Return the tenant-specific PrismaClient (cast as PrismaService)
        const client = await tenantPrisma.getClient(companyId);
        return client as unknown as PrismaService;
      },
      inject: [TenantPrismaService, REQUEST],
    },
  ],
  exports: [PrismaService, MasterPrismaService, TenantPrismaService],
})
export class DatabaseModule {}
