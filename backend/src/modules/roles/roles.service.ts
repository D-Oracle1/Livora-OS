import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Role name already exists');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: (dto.permissions as any) ?? [],
      },
      include: { _count: { select: { staffProfiles: true } } },
    });
  }

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { staffProfiles: true } } },
    });
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { staffProfiles: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictException('Role name already exists');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.permissions !== undefined) data.permissions = dto.permissions;

    return this.prisma.role.update({
      where: { id },
      data,
      include: { _count: { select: { staffProfiles: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { staffProfiles: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role._count.staffProfiles > 0) {
      throw new BadRequestException(
        `Cannot delete role: ${role._count.staffProfiles} staff member(s) are assigned to it`,
      );
    }
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }
}
