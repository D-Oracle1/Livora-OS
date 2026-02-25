import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { PartialType } from '@nestjs/mapped-types';

class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

@Injectable()
export class ExpenseCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.expenseCategory.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { expenses: { where: { deletedAt: null } } } },
      },
    });
    return categories.map((c) => ({ ...c, expenseCount: c._count.expenses }));
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('A category with this name already exists');

    return this.prisma.expenseCategory.create({ data: dto });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOneOrFail(id);
    if (dto.name) {
      const dup = await this.prisma.expenseCategory.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } },
      });
      if (dup) throw new ConflictException('A category with this name already exists');
    }
    return this.prisma.expenseCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    const activeExpenses = await this.prisma.expense.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (activeExpenses > 0) {
      throw new ConflictException(
        `Cannot delete category: ${activeExpenses} expense(s) are assigned to it.`,
      );
    }
    await this.prisma.expenseCategory.delete({ where: { id } });
    return { message: 'Category deleted successfully' };
  }

  private async findOneOrFail(id: string) {
    const cat = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Expense category not found');
    return cat;
  }
}
