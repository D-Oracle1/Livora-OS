import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SearchResult {
  properties: any[];
  users: any[];
  clients: any[];
  realtors: any[];
  staff: any[];
  sales: any[];
  total: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    query: string,
    limit = 10,
    userRole?: string,
  ): Promise<SearchResult> {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { properties: [], users: [], clients: [], realtors: [], staff: [], sales: [], total: 0 };
    }

    const contains = { contains: q, mode: 'insensitive' as const };
    const take = Math.min(limit, 25);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER', 'HR'].includes(userRole ?? '');
    const canViewSales = isAdmin || userRole === 'REALTOR';

    const [properties, userResults, clientProfiles, realtorProfiles, staffResults, sales] =
      await Promise.allSettled([
        // Properties — visible to all roles
        this.prisma.property.findMany({
          where: {
            OR: [
              { title: contains },
              { city: contains },
              { state: contains },
              { address: contains },
              { description: contains },
            ],
          },
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            price: true,
            type: true,
            status: true,
            images: true,
            isListed: true,
          },
          take,
          orderBy: { createdAt: 'desc' },
        }),

        // Users — admin/HR only
        isAdmin
          ? this.prisma.user.findMany({
              where: {
                OR: [
                  { firstName: contains },
                  { lastName: contains },
                  { email: contains },
                  { phone: contains },
                ],
                role: { not: 'SUPER_ADMIN' },
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                avatar: true,
              },
              take,
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),

        // Clients
        this.prisma.clientProfile.findMany({
          where: {
            user: {
              OR: [
                { firstName: contains },
                { lastName: contains },
                { email: contains },
                { phone: contains },
              ],
            },
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
                status: true,
              },
            },
          },
          take,
          orderBy: { createdAt: 'desc' },
        }),

        // Realtors
        this.prisma.realtorProfile.findMany({
          where: {
            OR: [
              { user: { firstName: contains } },
              { user: { lastName: contains } },
              { user: { email: contains } },
              { licenseNumber: contains },
              { agency: contains },
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
                status: true,
              },
            },
          },
          take,
          orderBy: { createdAt: 'desc' },
        }),

        // Staff — admin/HR only; position is enum so only search title/user name
        isAdmin
          ? this.prisma.staffProfile.findMany({
              where: {
                OR: [
                  { user: { firstName: contains } },
                  { user: { lastName: contains } },
                  { user: { email: contains } },
                  { title: contains },
                ],
              },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    status: true,
                  },
                },
                department: { select: { name: true } },
              },
              take,
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),

        // Sales — admin/realtor only
        canViewSales
          ? this.prisma.sale.findMany({
              where: {
                OR: [
                  { property: { title: contains } },
                  { property: { city: contains } },
                  { client: { user: { firstName: contains } } },
                  { client: { user: { lastName: contains } } },
                  { realtor: { user: { firstName: contains } } },
                ],
              },
              include: {
                property: { select: { id: true, title: true, city: true } },
                client: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
                realtor: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
              take,
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
      ]);

    const safeGet = <T>(result: PromiseSettledResult<T>): any[] =>
      result.status === 'fulfilled' ? (result.value as any[]) : [];

    const propsResult = safeGet(properties);
    const usersResult = safeGet(userResults);
    const clientsResult = safeGet(clientProfiles);
    const realtorsResult = safeGet(realtorProfiles);
    const staffResult = safeGet(staffResults);
    const salesResult = safeGet(sales);

    return {
      properties: propsResult,
      users: usersResult,
      clients: clientsResult.map((c: any) => ({ id: c.id, ...c.user })),
      realtors: realtorsResult.map((r: any) => ({
        id: r.id,
        ...r.user,
        licenseNumber: r.licenseNumber,
        agency: r.agency,
        loyaltyTier: r.loyaltyTier,
        currentRank: r.currentRank,
      })),
      staff: staffResult.map((s: any) => ({
        id: s.id,
        ...s.user,
        position: s.position,
        title: s.title,
        department: s.department?.name,
      })),
      sales: salesResult,
      total:
        propsResult.length +
        usersResult.length +
        clientsResult.length +
        realtorsResult.length +
        staffResult.length +
        salesResult.length,
    };
  }
}
