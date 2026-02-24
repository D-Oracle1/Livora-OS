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
      // Guard: PrismaClient constructor validates the datasource URL format.
      // If DATABASE_URL is missing or invalid (e.g. cold-start env race), catch
      // the validation error here so it surfaces at query-time, not DI-time.
      try {
        const fallback = new PrismaService();
        cachedFallback = fallback;
        return fallback;
      } catch (err: any) {
        new Logger('DatabaseModule').warn(
          `Fallback PrismaService init failed (DATABASE_URL may be unset): ${err.message}`,
        );
        // Reset so the next request retries construction (env may become available)
        fallbackInitPromise = null;
        throw err;
      }
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
