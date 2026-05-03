import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { TransferPropertyDto } from './dto/transfer-property.dto';

@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Haversine distance (km) ──────────────────────────────────────────────
  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Branch code "${dto.code}" is already in use`);

    if (dto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerId },
        include: { managedBranch: true },
      });
      if (!manager) throw new NotFoundException('Manager user not found');
      if (manager.managedBranch) throw new ConflictException('User is already managing another branch');
    }

    return this.prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'Nigeria',
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        email: dto.email,
        managerId: dto.managerId,
        isActive: dto.isActive ?? true,
      },
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async findAll(filters: { city?: string; isActive?: boolean; search?: string } = {}) {
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.branch.findMany({
      where,
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        _count: { select: { users: true, properties: true, sales: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, phone: true } },
        _count: { select: { users: true, properties: true, sales: true, expenses: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);

    if (dto.code) {
      const conflict = await this.prisma.branch.findFirst({ where: { code: dto.code.toUpperCase(), NOT: { id } } });
      if (conflict) throw new ConflictException(`Branch code "${dto.code}" is already in use`);
    }

    if (dto.managerId) {
      const manager = await this.prisma.user.findUnique({ where: { id: dto.managerId } });
      if (!manager) throw new NotFoundException('Manager user not found');
      const existingManage = await this.prisma.branch.findFirst({
        where: { managerId: dto.managerId, NOT: { id } },
      });
      if (existingManage) throw new ConflictException('User is already managing another branch');
    }

    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.address && { address: dto.address }),
        ...(dto.city && { city: dto.city }),
        ...(dto.state && { state: dto.state }),
        ...(dto.country && { country: dto.country }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async remove(id: string) {
    const branch = await this.findOne(id);
    if (branch._count.users > 0) {
      throw new BadRequestException('Cannot delete a branch with assigned staff. Reassign users first.');
    }
    if (branch._count.properties > 0) {
      throw new BadRequestException('Cannot delete a branch with active properties. Transfer them first.');
    }
    return this.prisma.branch.delete({ where: { id } });
  }

  // ─── Branch Stats ─────────────────────────────────────────────────────────

  async getStats(branchId: string, startDate?: string, endDate?: string) {
    await this.findOne(branchId);

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd   = endDate   ? new Date(endDate)   : new Date();

    const [users, properties, salesAgg, expensesAgg, leads] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { branchId },
        _count: true,
      }),
      this.prisma.property.groupBy({
        by: ['status'],
        where: { branchId, deletedAt: null },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: { branchId, createdAt: { gte: periodStart, lte: periodEnd } },
        _sum: { salePrice: true, commissionAmount: true, netAmount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { branchId, deletedAt: null, expenseDate: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      // Leads are raw-SQL so we use $queryRaw
      this.prisma.$queryRaw<{ status: string; count: bigint }[]>`
        SELECT status, COUNT(*) as count
        FROM leads
        WHERE "branchId" = ${branchId}
          AND "createdAt" >= ${periodStart}
          AND "createdAt" <= ${periodEnd}
        GROUP BY status
      `.catch(() => [] as any[]),
    ]);

    const totalRevenue  = Number(salesAgg._sum.salePrice ?? 0);
    const totalExpenses = Number(expensesAgg._sum.amount ?? 0);

    return {
      period: { startDate: periodStart, endDate: periodEnd },
      staff: users.reduce((acc, r) => ({ ...acc, [r.role]: r._count }), {} as Record<string, number>),
      properties: properties.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {} as Record<string, number>),
      sales: {
        count:      salesAgg._count,
        revenue:    totalRevenue,
        commission: Number(salesAgg._sum.commissionAmount ?? 0),
        netProfit:  Number(salesAgg._sum.netAmount ?? 0),
      },
      expenses: {
        count:  expensesAgg._count,
        amount: totalExpenses,
      },
      netProfit: totalRevenue - totalExpenses,
      leads:     leads.map((l) => ({ status: l.status, count: Number(l.count) })),
    };
  }

  // ─── Agent Performance per Branch ─────────────────────────────────────────

  async getAgentPerformance(branchId: string, startDate?: string, endDate?: string) {
    await this.findOne(branchId);

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd   = endDate   ? new Date(endDate)   : new Date();

    const agents = await this.prisma.user.findMany({
      where: { branchId, role: 'REALTOR' },
      include: {
        realtorProfile: {
          include: {
            sales: {
              where: { branchId, createdAt: { gte: periodStart, lte: periodEnd } },
              select: { salePrice: true, commissionAmount: true, status: true },
            },
          },
        },
      },
    });

    return agents.map((agent) => {
      const sales = agent.realtorProfile?.sales ?? [];
      const completed = sales.filter((s) => s.status === 'COMPLETED');
      return {
        agentId:    agent.id,
        name:       `${agent.firstName} ${agent.lastName}`,
        email:      agent.email,
        avatar:     agent.avatar,
        totalSales: completed.length,
        totalRevenue: completed.reduce((sum, s) => sum + Number(s.salePrice), 0),
        totalCommission: completed.reduce((sum, s) => sum + Number(s.commissionAmount), 0),
      };
    });
  }

  // ─── Inter-Branch Property Transfer ───────────────────────────────────────

  async initiateTransfer(propertyId: string, dto: TransferPropertyDto, initiatedById: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!property.branchId) throw new BadRequestException('Property has no current branch assignment');
    if (property.branchId === dto.toBranchId) throw new BadRequestException('Property is already in the target branch');

    const targetBranch = await this.prisma.branch.findUnique({ where: { id: dto.toBranchId } });
    if (!targetBranch) throw new NotFoundException('Target branch not found');
    if (!targetBranch.isActive) throw new BadRequestException('Target branch is inactive');

    const pending = await this.prisma.propertyTransfer.findFirst({
      where: { propertyId, status: 'PENDING' },
    });
    if (pending) throw new ConflictException('A transfer request for this property is already pending');

    return this.prisma.propertyTransfer.create({
      data: {
        propertyId,
        fromBranchId:  property.branchId,
        toBranchId:    dto.toBranchId,
        initiatedById,
        reason:        dto.reason,
        status:        'PENDING',
      },
      include: {
        property:   { select: { id: true, title: true } },
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch:   { select: { id: true, name: true, code: true } },
      },
    });
  }

  async approveTransfer(transferId: string, approverId: string) {
    const transfer = await this.prisma.propertyTransfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== 'PENDING') throw new BadRequestException('Transfer is not in pending state');

    const [updated] = await this.prisma.$transaction([
      this.prisma.propertyTransfer.update({
        where: { id: transferId },
        data: { status: 'APPROVED', approvedById: approverId },
      }),
      this.prisma.property.update({
        where: { id: transfer.propertyId },
        data: { branchId: transfer.toBranchId },
      }),
    ]);

    return updated;
  }

  async rejectTransfer(transferId: string, approverId: string) {
    const transfer = await this.prisma.propertyTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== 'PENDING') throw new BadRequestException('Transfer is not in pending state');

    return this.prisma.propertyTransfer.update({
      where: { id: transferId },
      data: { status: 'REJECTED', approvedById: approverId },
    });
  }

  async getTransfers(branchId?: string, status?: string) {
    const where: any = {};
    if (branchId) where.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }];
    if (status) where.status = status;

    return this.prisma.propertyTransfer.findMany({
      where,
      include: {
        property:   { select: { id: true, title: true, type: true, city: true } },
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch:   { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Geo-based Branch Assignment ──────────────────────────────────────────

  async findNearestBranch(latitude: number, longitude: number): Promise<string | null> {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true, name: true },
    });

    if (branches.length === 0) return null;

    let nearest = branches[0];
    let minDist = this.haversine(latitude, longitude, nearest.latitude!, nearest.longitude!);

    for (const b of branches.slice(1)) {
      const dist = this.haversine(latitude, longitude, b.latitude!, b.longitude!);
      if (dist < minDist) { minDist = dist; nearest = b; }
    }

    return nearest.id;
  }

  // ─── Branch Reporting ─────────────────────────────────────────────────────

  async getAllBranchesReport(startDate?: string, endDate?: string) {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, city: true },
    });

    const reports = await Promise.all(
      branches.map(async (b) => ({
        branchId:   b.id,
        branchName: b.name,
        branchCode: b.code,
        city:       b.city,
        ...(await this.getStats(b.id, startDate, endDate)),
      })),
    );

    return reports;
  }

  // ─── Assign user to branch ─────────────────────────────────────────────────

  async assignUserToBranch(userId: string, branchId: string, actorRole: string) {
    if (!['SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER'].includes(actorRole)) {
      throw new ForbiddenException('Only admins can assign users to branches');
    }

    const [user, branch] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { branchId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, branchId: true },
    });
  }

  async removeUserFromBranch(userId: string, actorRole: string) {
    if (!['SUPER_ADMIN', 'ADMIN', 'GENERAL_OVERSEER'].includes(actorRole)) {
      throw new ForbiddenException('Only admins can reassign users');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { branchId: null },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
  }
}
