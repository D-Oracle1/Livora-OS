import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MasterPrismaService } from '../../database/master-prisma.service';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        companyId: string | null;
        domain: string;
        company?: {
          id: string;
          name: string;
          slug: string;
          domain: string;
          logo: string | null;
          primaryColor: string | null;
          isActive: boolean;
        } | null;
      };
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  // Cache company lookups for 5 minutes
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(private readonly masterPrisma: MasterPrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = (req.hostname || req.headers.host?.split(':')[0] || '').toLowerCase();
    const domain = host.replace(/^www\./, '');

    // Check if this is the master domain
    if (this.isMasterDomain(domain)) {
      // 1. Explicit header takes priority (admin dashboard, api helper)
      const headerId = req.headers['x-company-id'] as string | undefined;
      if (headerId) {
        const co = await this.resolveCompanyById(headerId);
        if (co?.isActive) {
          req.tenant = { companyId: co.id, domain: co.domain, company: co };
          return next();
        }
      }

      // 2. Fall back to Origin header — handles cross-origin requests from a
      //    tenant frontend on a custom domain (e.g. vicsondigital.online) calling
      //    the backend on *.vercel.app without an explicit X-Company-ID header.
      const origin = req.headers['origin'] as string | undefined;
      if (origin) {
        try {
          const originDomain = new URL(origin).hostname.replace(/^www\./, '').toLowerCase();
          if (!this.isMasterDomain(originDomain)) {
            const co = await this.resolveCompany(originDomain);
            if (co?.isActive) {
              req.tenant = { companyId: co.id, domain: co.domain, company: co };
              return next();
            }
          }
        } catch { /* malformed Origin — ignore */ }
      }

      req.tenant = { companyId: null, domain, company: null };
      return next();
    }

    // Look up company by domain (with cache)
    const company = await this.resolveCompany(domain);

    if (company && company.isActive) {
      req.tenant = {
        companyId: company.id,
        domain,
        company,
      };
    } else {
      // Unknown or inactive domain — treat as master domain for now
      // This allows the app to still respond (public landing, login, etc.)
      req.tenant = { companyId: null, domain, company: null };
    }

    next();
  }

  private async resolveCompanyById(id: string): Promise<any | null> {
    const key = `id:${id}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const company = await this.masterPrisma.company.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          logo: true,
          primaryColor: true,
          isActive: true,
        },
      });

      this.cache.set(key, {
        data: company,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return company;
    } catch (error) {
      this.logger.error(`Failed to resolve company by id ${id}: ${error}`);
      return null;
    }
  }

  private async resolveCompany(domain: string): Promise<any | null> {
    // Check cache
    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const company = await this.masterPrisma.company.findUnique({
        where: { domain },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          logo: true,
          primaryColor: true,
          isActive: true,
        },
      });

      this.cache.set(domain, {
        data: company,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return company;
    } catch (error) {
      this.logger.error(`Failed to resolve company for domain ${domain}: ${error}`);
      return null;
    }
  }

  private isMasterDomain(domain: string): boolean {
    // Backend's own Vercel/Railway deployment domains are always master
    if (domain.endsWith('.vercel.app') || domain.endsWith('.railway.app')) {
      return true;
    }

    const masterDomains = [
      'localhost',
      '127.0.0.1',
      process.env.MASTER_DOMAIN,
    ].filter(Boolean);

    return masterDomains.some((d) => domain === d || domain.startsWith(`${d}:`));
  }

  /** Clear cache for a specific domain or company id (call after company update) */
  clearCache(domainOrId?: string) {
    if (domainOrId) {
      this.cache.delete(domainOrId);
      this.cache.delete(`id:${domainOrId}`);
    } else {
      this.cache.clear();
    }
  }
}
