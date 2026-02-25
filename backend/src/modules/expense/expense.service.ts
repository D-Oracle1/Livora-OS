import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { ExpenseApprovalStatus, Prisma } from '@prisma/client';

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreateExpenseDto, userId: string) {
    // Validate category exists
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new BadRequestException('Expense category not found');

    const expense = await this.prisma.expense.create({
      data: {
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        amount: new Prisma.Decimal(dto.amount),
        paymentMethod: dto.paymentMethod ?? 'CASH',
        expenseDate: new Date(dto.expenseDate),
        referenceNumber: dto.referenceNumber,
        receiptUrl: dto.receiptUrl,
        departmentId: dto.departmentId,
        createdById: userId,
        approvalStatus: 'PENDING',
      },
      include: { category: true, createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });

    // Audit log
    await this.writeAuditLog(expense.id, userId, 'CREATED', null, {
      title: expense.title,
      amount: expense.amount,
      category: expense.category.name,
      expenseDate: expense.expenseDate,
    });

    return expense;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ExpenseQueryDto) {
    const page = parseInt(query.page ?? '1', 10);
    const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.approvalStatus) where.approvalStatus = query.approvalStatus;
    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) where.expenseDate.gte = new Date(query.startDate);
      if (query.endDate) where.expenseDate.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: 'desc' },
        include: {
          category: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Find One ────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
      },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateExpenseDto, userId: string) {
    const expense = await this.findOneOrFail(id);

    if (expense.approvalStatus === 'APPROVED') {
      throw new ForbiddenException('Approved expenses cannot be edited. Reject it first.');
    }

    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (dto.title !== undefined && dto.title !== expense.title) {
      oldValues.title = expense.title;
      newValues.title = dto.title;
    }
    if (dto.amount !== undefined && Number(expense.amount) !== dto.amount) {
      oldValues.amount = expense.amount;
      newValues.amount = dto.amount;
    }
    if (dto.expenseDate && new Date(dto.expenseDate).getTime() !== expense.expenseDate.getTime()) {
      oldValues.expenseDate = expense.expenseDate;
      newValues.expenseDate = dto.expenseDate;
    }
    if (dto.categoryId && dto.categoryId !== expense.categoryId) {
      oldValues.categoryId = expense.categoryId;
      newValues.categoryId = dto.categoryId;
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.amount !== undefined && { amount: new Prisma.Decimal(dto.amount) }),
        ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
        ...(dto.expenseDate !== undefined && { expenseDate: new Date(dto.expenseDate) }),
        ...(dto.referenceNumber !== undefined && { referenceNumber: dto.referenceNumber }),
        ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        approvalStatus: 'PENDING', // Reset to pending on edit
      },
      include: { category: true },
    });

    if (Object.keys(newValues).length > 0) {
      await this.writeAuditLog(id, userId, 'UPDATED', oldValues, newValues);
    }

    return updated;
  }

  // ─── Approve ─────────────────────────────────────────────────────────────────

  async approve(id: string, adminId: string) {
    const expense = await this.findOneOrFail(id);
    if (expense.approvalStatus === 'APPROVED') {
      throw new BadRequestException('Expense is already approved');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: ExpenseApprovalStatus.APPROVED,
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: { category: true },
    });

    await this.writeAuditLog(id, adminId, 'APPROVED', { approvalStatus: expense.approvalStatus }, { approvalStatus: 'APPROVED' });
    return updated;
  }

  // ─── Reject ──────────────────────────────────────────────────────────────────

  async reject(id: string, reason: string, adminId: string) {
    const expense = await this.findOneOrFail(id);
    if (expense.approvalStatus === 'REJECTED') {
      throw new BadRequestException('Expense is already rejected');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: ExpenseApprovalStatus.REJECTED,
        rejectionReason: reason,
        approvedById: adminId,
        approvedAt: new Date(),
      },
      include: { category: true },
    });

    await this.writeAuditLog(id, adminId, 'REJECTED', { approvalStatus: expense.approvalStatus }, { approvalStatus: 'REJECTED', reason });
    return updated;
  }

  // ─── Soft Delete ─────────────────────────────────────────────────────────────

  async softDelete(id: string, userId: string) {
    const expense = await this.findOneOrFail(id);
    await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.writeAuditLog(id, userId, 'DELETED', { title: expense.title, amount: expense.amount }, null);
    return { message: 'Expense deleted successfully' };
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  async getStats(startDate?: string, endDate?: string) {
    const dateFilter: Prisma.ExpenseWhereInput = { deletedAt: null };
    if (startDate || endDate) {
      dateFilter.expenseDate = {};
      if (startDate) (dateFilter.expenseDate as any).gte = new Date(startDate);
      if (endDate) (dateFilter.expenseDate as any).lte = new Date(endDate);
    }

    const [approved, pending, rejected, byCategory, byPaymentMethod] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { ...dateFilter, approvalStatus: 'APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...dateFilter, approvalStatus: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...dateFilter, approvalStatus: 'REJECTED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { ...dateFilter, approvalStatus: 'APPROVED' },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      this.prisma.expense.groupBy({
        by: ['paymentMethod'],
        where: { ...dateFilter, approvalStatus: 'APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Enrich category breakdown with names
    const categoryIds = byCategory.map((c) => c.categoryId);
    const categories = categoryIds.length
      ? await this.prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } } })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return {
      approved: { total: Number(approved._sum.amount ?? 0), count: approved._count },
      pending: { total: Number(pending._sum.amount ?? 0), count: pending._count },
      rejected: { total: Number(rejected._sum.amount ?? 0), count: rejected._count },
      byCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        categoryName: categoryMap.get(c.categoryId) ?? 'Unknown',
        total: Number(c._sum.amount ?? 0),
        count: c._count,
      })),
      byPaymentMethod: byPaymentMethod.map((p) => ({
        method: p.paymentMethod,
        total: Number(p._sum.amount ?? 0),
        count: p._count,
      })),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findOneOrFail(id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  private async writeAuditLog(
    expenseId: string,
    userId: string,
    action: string,
    oldValues: any,
    newValues: any,
  ) {
    try {
      await this.prisma.expenseAuditLog.create({
        data: { expenseId, userId, action, oldValues, newValues },
      });
    } catch {
      // Non-critical — do not throw
    }
  }
}
