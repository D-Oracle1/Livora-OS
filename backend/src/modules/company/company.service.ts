import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { v4 as uuidv4 } from 'uuid';
import { del } from '@vercel/blob';
import { Client as PgClient } from 'pg';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async create(dto: CreateCompanyDto): Promise<any> {
    // Check slug uniqueness
    const existingSlug = await this.masterPrisma.company.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException('Company slug already in use');
    }

    // Check domain uniqueness
    const existingDomain = await this.masterPrisma.company.findUnique({
      where: { domain: dto.domain },
    });
    if (existingDomain) {
      throw new ConflictException('Domain already in use');
    }

    // Provision a new database for this tenant
    this.logger.log(`Provisioning database for ${dto.slug}...`);
    const databaseUrl = await this.tenantPrisma.provisionDatabase(dto.slug);

    // Create company record in master DB
    const inviteCode = this.generateInviteCode();
    const company = await this.masterPrisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        databaseUrl,
        logo: dto.logo,
        primaryColor: dto.primaryColor || '#3b82f6',
        inviteCode,
        maxUsers: dto.maxUsers || 50,
      },
    });

    this.logger.log(`Company created: ${company.name} (${company.slug})`);

    // Seed branding into the tenant DB CMS so useBranding() picks it up immediately
    await this.syncBrandingToTenant(company.id, {
      name: company.name,
      logo: company.logo || undefined,
      primaryColor: company.primaryColor || undefined,
    });

    // Return company without databaseUrl for security
    const { databaseUrl: _, ...safeCompany } = company;
    return safeCompany;
  }

  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { domain: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.masterPrisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          logo: true,
          primaryColor: true,
          inviteCode: true,
          isActive: true,
          plan: true,
          maxUsers: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.masterPrisma.company.count({ where }),
    ]);

    // Fetch user counts for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        try {
          const stats = await this.getCompanyQuickStats(company.id);
          return { ...company, stats };
        } catch {
          return { ...company, stats: { users: 0, properties: 0, sales: 0 } };
        }
      }),
    );

    return {
      data: companiesWithStats,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    let company: any;
    try {
      company = await this.masterPrisma.company.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          logo: true,
          primaryColor: true,
          inviteCode: true,
          isActive: true,
          plan: true,
          maxUsers: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      this.logger.error(`findById DB error for ${id}: ${error.message}`);
      throw new BadRequestException('Failed to retrieve company. Please try again.');
    }

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const stats = await this.getCompanyDetailedStats(id);
    return { ...company, stats };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.masterPrisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Check domain uniqueness if changing
    if (dto.domain && dto.domain !== company.domain) {
      const existing = await this.masterPrisma.company.findUnique({
        where: { domain: dto.domain },
      });
      if (existing) {
        throw new ConflictException('Domain already in use');
      }
    }

    const updated = await this.masterPrisma.company.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logo: true,
        primaryColor: true,
        inviteCode: true,
        isActive: true,
        plan: true,
        maxUsers: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Sync branding changes to the tenant DB CMS so the tenant frontend reflects updates
    if (dto.name || dto.logo !== undefined || dto.primaryColor) {
      await this.syncBrandingToTenant(id, {
        name: dto.name,
        logo: dto.logo,
        primaryColor: dto.primaryColor,
      });
    }

    return updated;
  }

  /**
   * Syncs name/logo/primaryColor into the tenant DB CMS branding settings.
   * This ensures useBranding() on the tenant frontend picks up master-dashboard changes.
   */
  private async syncBrandingToTenant(
    companyId: string,
    branding: { name?: string; logo?: string; primaryColor?: string },
  ): Promise<void> {
    try {
      const client = await this.tenantPrisma.getClient(companyId);
      const existing = await client.systemSetting.findUnique({
        where: { key: 'cms_branding' },
      });
      const current: Record<string, any> = existing ? (existing.value as any) : {};
      const merged: Record<string, any> = { ...current };
      if (branding.name) merged.companyName = branding.name;
      if (branding.logo !== undefined) merged.logo = branding.logo;
      if (branding.primaryColor) merged.primaryColor = branding.primaryColor;

      await client.systemSetting.upsert({
        where: { key: 'cms_branding' },
        create: { key: 'cms_branding', value: merged },
        update: { value: merged },
      });
      this.logger.debug(`Branding synced to tenant DB: ${companyId}`);
    } catch (e: any) {
      // Non-critical — log a warning but don't fail the main operation
      this.logger.warn(`Branding sync skipped (${companyId}): ${e.message}`);
    }
  }

  async toggleActive(id: string) {
    const company = await this.masterPrisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // If deactivating, wipe all tenant sessions first (while DB is still accessible)
    if (company.isActive) {
      try {
        const tenantClient = await this.tenantPrisma.getClient(id);
        await tenantClient.refreshToken.deleteMany({});
      } catch (e: any) {
        this.logger.warn(`Could not clear sessions for ${id}: ${e.message}`);
      }
    }

    const updated = await this.masterPrisma.company.update({
      where: { id },
      data: { isActive: !company.isActive },
    });

    // If deactivating, disconnect tenant client to enforce the lockout
    if (!updated.isActive) {
      await this.tenantPrisma.disconnectTenant(id);
    }

    return { id: updated.id, isActive: updated.isActive };
  }

  async regenerateInviteCode(id: string) {
    const company = await this.masterPrisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const inviteCode = this.generateInviteCode();
    const updated = await this.masterPrisma.company.update({
      where: { id },
      data: { inviteCode },
      select: { id: true, inviteCode: true },
    });

    return updated;
  }

  async resolveByDomain(domain: string) {
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

    return company;
  }

  async resolveByInviteCode(code: string) {
    const company = await this.masterPrisma.company.findUnique({
      where: { inviteCode: code },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logo: true,
        isActive: true,
      },
    });

    return company;
  }

  async getOverviewStats() {
    const [totalCompanies, activeCompanies] = await Promise.all([
      this.masterPrisma.company.count(),
      this.masterPrisma.company.count({ where: { isActive: true } }),
    ]);

    // Aggregate stats from all active tenant DBs
    const companies = await this.masterPrisma.company.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let totalUsers = 0;
    let totalProperties = 0;
    let totalSales = 0;

    for (const company of companies) {
      try {
        const stats = await this.getCompanyQuickStats(company.id);
        totalUsers += stats.users;
        totalProperties += stats.properties;
        totalSales += stats.sales;
      } catch {
        // Skip companies with DB issues
      }
    }

    return {
      totalCompanies,
      activeCompanies,
      totalUsers,
      totalProperties,
      totalSales,
    };
  }

  private async getCompanyQuickStats(companyId: string) {
    try {
      const client = await this.tenantPrisma.getClient(companyId);
      const [users, properties, sales] = await Promise.all([
        client.user.count(),
        client.property.count(),
        client.sale.count(),
      ]);
      return { users, properties, sales };
    } catch {
      return { users: 0, properties: 0, sales: 0 };
    }
  }

  private async getCompanyDetailedStats(companyId: string) {
    try {
      const client = await this.tenantPrisma.getClient(companyId);
      const [users, realtors, clients, properties, sales, revenue] =
        await Promise.all([
          client.user.count(),
          client.realtorProfile.count(),
          client.clientProfile.count(),
          client.property.count(),
          client.sale.count(),
          client.sale.aggregate({ _sum: { salePrice: true } }),
        ]);
      return {
        users,
        realtors,
        clients,
        properties,
        sales,
        revenue: revenue._sum.salePrice || 0,
      };
    } catch {
      return {
        users: 0,
        realtors: 0,
        clients: 0,
        properties: 0,
        sales: 0,
        revenue: 0,
      };
    }
  }

  async registerExisting(dto: {
    name: string;
    slug: string;
    domain: string;
    databaseUrl: string;
    logo?: string;
    primaryColor?: string;
    maxUsers?: number;
  }) {
    const existingSlug = await this.masterPrisma.company.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) throw new ConflictException('Company slug already in use');

    const existingDomain = await this.masterPrisma.company.findUnique({ where: { domain: dto.domain } });
    if (existingDomain) throw new ConflictException('Domain already in use');

    const inviteCode = this.generateInviteCode();
    const company = await this.masterPrisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        databaseUrl: dto.databaseUrl,
        logo: dto.logo,
        primaryColor: dto.primaryColor || '#3b82f6',
        inviteCode,
        maxUsers: dto.maxUsers || 50,
      },
    });

    const { databaseUrl: _, ...safeCompany } = company;
    return safeCompany;
  }

  async getCompanyUsers(
    companyId: string,
    query: { page?: number; limit?: number },
  ) {
    const company = await this.masterPrisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company not found');

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    try {
      const client = await this.tenantPrisma.getClient(companyId);
      const [users, total] = await Promise.all([
        client.user.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        }),
        client.user.count(),
      ]);
      return {
        data: users,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  async assignUserRole(companyId: string, userId: string, role: string) {
    const allowedRoles = ['ADMIN', 'REALTOR', 'CLIENT', 'STAFF', 'GENERAL_OVERSEER'];
    if (!allowedRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Allowed: ${allowedRoles.join(', ')}`);
    }

    const company = await this.masterPrisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company not found');

    try {
      const client = await this.tenantPrisma.getClient(companyId);
      const updated = await client.user.update({
        where: { id: userId },
        data: { role: role as any },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      });
      return updated;
    } catch {
      throw new NotFoundException('User not found in this company');
    }
  }

  async reprovisionTenant(id: string) {
    const company = await this.masterPrisma.company.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!company) throw new NotFoundException('Company not found');
    await this.tenantPrisma.provisionDatabase(company.slug);
    return { message: `Tenant schema for "${company.slug}" has been migrated successfully` };
  }

  async exportTenantData(companyId: string): Promise<{ buffer: Buffer; filename: string }> {
    const company = await this.masterPrisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const client = await this.tenantPrisma.getClient(companyId);

    const [users, staff, clients, realtors, properties, sales, commissions] = await Promise.all([
      client.user.findMany({
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      client.staffProfile.findMany({
        include: { user: { select: { email: true, firstName: true, lastName: true, phone: true, status: true } }, department: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      client.clientProfile.findMany({
        include: {
          user: { select: { email: true, firstName: true, lastName: true, phone: true, status: true } },
          realtor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      client.realtorProfile.findMany({
        include: { user: { select: { email: true, firstName: true, lastName: true, phone: true, status: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      client.property.findMany({
        select: { title: true, type: true, status: true, price: true, address: true, city: true, state: true, country: true, bedrooms: true, bathrooms: true, area: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
      client.sale.findMany({
        include: {
          property: { select: { title: true } },
          client: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          realtor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
      client.commission.findMany({
        include: {
          realtor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RMS Platform';
    workbook.created = new Date();

    const addSheet = (name: string, headers: string[], rows: any[][]) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(headers);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e40af' } };
      headerRow.alignment = { vertical: 'middle' };
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      headers.forEach((_, i) => { sheet.getColumn(i + 1).width = 22; });
      rows.forEach(r => sheet.addRow(r));
    };

    const fmt = (d: any) => d ? new Date(d).toISOString().split('T')[0] : '';
    const name = (u: any) => u ? `${u.firstName} ${u.lastName}` : '';

    addSheet('Users',
      ['ID', 'Email', 'First Name', 'Last Name', 'Phone', 'Role', 'Status', 'Created'],
      users.map(u => [u.id, u.email, u.firstName, u.lastName, u.phone ?? '', u.role, u.status, fmt(u.createdAt)]),
    );

    addSheet('Staff',
      ['Employee ID', 'Name', 'Email', 'Phone', 'Position', 'Job Title', 'Department', 'Type', 'Salary', 'Currency', 'Hire Date', 'Status'],
      staff.map(s => [s.employeeId, name(s.user), s.user?.email ?? '', s.user?.phone ?? '', s.position, s.title, s.department?.name ?? '', s.employmentType, Number(s.baseSalary), s.currency, fmt(s.hireDate), s.user?.status ?? '']),
    );

    addSheet('Clients',
      ['Name', 'Email', 'Phone', 'Status', 'Assigned Realtor', 'Realtor Email', 'Total Purchase Value', 'Properties'],
      clients.map(c => [name(c.user), c.user?.email ?? '', c.user?.phone ?? '', c.user?.status ?? '', name(c.realtor?.user), c.realtor?.user?.email ?? '', Number(c.totalPurchaseValue), 0]),
    );

    addSheet('Realtors',
      ['Name', 'Email', 'Phone', 'Status', 'License No.', 'Agency', 'Specializations', 'Loyalty Tier', 'Total Sales', 'Total Commission'],
      realtors.map(r => [name(r.user), r.user?.email ?? '', r.user?.phone ?? '', r.user?.status ?? '', r.licenseNumber, r.agency ?? '', (r.specializations as string[])?.join(', ') ?? '', r.loyaltyTier, r.totalSales, Number(r.totalCommission)]),
    );

    addSheet('Properties',
      ['Title', 'Type', 'Status', 'Price', 'Address', 'City', 'State', 'Country', 'Beds', 'Baths', 'Area (sqft)', 'Listed Date'],
      (properties as any[]).map(p => [p.title, p.type, p.status, Number(p.price), p.address ?? '', p.city ?? '', p.state ?? '', p.country ?? '', p.bedrooms ?? '', p.bathrooms ?? '', p.area ?? '', fmt(p.createdAt)]),
    );

    addSheet('Sales',
      ['Date', 'Property', 'Client', 'Client Email', 'Realtor', 'Realtor Email', 'Sale Price', 'Status'],
      (sales as any[]).map(s => [fmt(s.saleDate ?? s.createdAt), s.property?.title ?? '', name(s.client?.user), s.client?.user?.email ?? '', name(s.realtor?.user), s.realtor?.user?.email ?? '', Number(s.salePrice), s.status]),
    );

    addSheet('Commissions',
      ['Realtor', 'Realtor Email', 'Amount', 'Rate (%)', 'Status', 'Paid At'],
      (commissions as any[]).map(c => [name(c.realtor?.user), c.realtor?.user?.email ?? '', Number(c.amount), Number(c.rate ?? 0), c.status, fmt(c.paidAt)]),
    );

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${company.slug}-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    return { buffer: buffer as Buffer, filename };
  }

  /**
   * Re-apply the tenant schema DDL to EVERY active company in sequence.
   * Idempotent — safe to run at any time without data loss.
   */
  async migrateAllTenants(): Promise<{ migrated: number; failed: number; results: { slug: string; ok: boolean; error?: string }[] }> {
    const companies = await this.masterPrisma.company.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });

    const results: { slug: string; ok: boolean; error?: string }[] = [];
    let migrated = 0;
    let failed = 0;

    for (const co of companies) {
      try {
        await this.tenantPrisma.provisionDatabase(co.slug);
        results.push({ slug: co.slug, ok: true });
        migrated++;
      } catch (e: any) {
        this.logger.error(`Migration failed for ${co.slug}: ${e.message}`);
        results.push({ slug: co.slug, ok: false, error: e.message?.slice(0, 120) });
        failed++;
      }
    }

    this.logger.log(`Migrate-all complete: ${migrated} ok, ${failed} failed`);
    return { migrated, failed, results };
  }

  /**
   * Permanently delete a company: wipe all tenant data, delete Vercel Blob files,
   * and remove the company record from the master DB.
   */
  async purgeTenant(id: string): Promise<{ message: string; deletedBlobs: number }> {
    const company = await this.masterPrisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, databaseUrl: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    // 1. Collect all Vercel Blob URLs from the tenant DB before truncation
    const blobUrls: string[] = [];
    try {
      const tenantClient = await this.tenantPrisma.getClient(id);
      const users = await tenantClient.user.findMany({
        where: { avatar: { not: null } },
        select: { avatar: true },
      });
      blobUrls.push(...users.map((u) => u.avatar!).filter(Boolean));

      const props = await (tenantClient as any).property
        .findMany({ select: { images: true } })
        .catch(() => []);
      for (const p of props) {
        if (Array.isArray(p.images)) {
          blobUrls.push(
            ...p.images.filter((u: any) => typeof u === 'string' && u.startsWith('https://')),
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`Blob collection skipped for ${id}: ${e.message}`);
    }

    // 2. Delete blobs
    let deletedBlobs = 0;
    for (const url of blobUrls) {
      try {
        await del(url);
        deletedBlobs++;
      } catch { /* ignore individual failures */ }
    }

    // 3. Truncate all tenant tables via raw pg connection (CASCADE handles FK order)
    try {
      let connStr = company.databaseUrl;
      try {
        const u = new URL(company.databaseUrl);
        // Supabase: switch transaction pooler → session pooler for DDL
        if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') {
          u.port = '5432';
        }
        const params = new URLSearchParams(u.search);
        params.delete('pgbouncer');
        params.delete('connection_limit');
        u.search = params.toString();
        connStr = u.toString();
      } catch { /* use original */ }

      const pgClient = new PgClient({ connectionString: connStr });
      await pgClient.connect();
      try {
        const res = await pgClient.query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
        );
        const tables = res.rows.map((r) => `"${r.tablename}"`).join(', ');
        if (tables) {
          await pgClient.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
        }
      } finally {
        await pgClient.end();
      }
    } catch (e: any) {
      this.logger.warn(`Tenant table truncation failed for ${id}: ${e.message}`);
    }

    // 4. Remove company from master DB and evict the cached tenant client
    await this.masterPrisma.company.delete({ where: { id } });
    await this.tenantPrisma.disconnectTenant(id).catch(() => {});

    this.logger.log(`Tenant purged: ${company.name} (${company.slug}). Blobs deleted: ${deletedBlobs}`);
    return { message: `Company "${company.name}" has been permanently deleted`, deletedBlobs };
  }

  /**
   * Permanently delete multiple companies in sequence.
   */
  async bulkPurgeTenants(ids: string[]): Promise<{ message: string; deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;
    for (const id of ids) {
      try {
        await this.purgeTenant(id);
        deleted++;
      } catch (e: any) {
        this.logger.error(`Failed to purge tenant ${id}: ${e.message}`);
        errors++;
      }
    }
    return { message: `Purge complete: ${deleted} deleted, ${errors} failed`, deleted, errors };
  }

  private generateInviteCode(): string {
    return `INV-${uuidv4().substring(0, 8).toUpperCase()}`;
  }
}
