import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
  }) {
    const { page = 1, limit = 20, role, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      role: { not: UserRole.SUPER_ADMIN },
    };

    if (role && role !== UserRole.SUPER_ADMIN) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          staffProfile: {
            select: {
              title: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        adminProfile: true,
        realtorProfile: true,
        clientProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async updateStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { staffProfile: { select: { id: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.user.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      // Sync staffProfile.isActive when changing status for a staff user
      if (user.staffProfile) {
        await prisma.staffProfile.update({
          where: { id: user.staffProfile.id },
          data: {
            isActive: status === UserStatus.ACTIVE,
            ...(status === UserStatus.ACTIVE ? { terminationDate: null } : {}),
          },
        });
      }

      return updated;
    });
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async updateRole(id: string, newRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { realtorProfile: true, clientProfile: true, adminProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === newRole) {
      throw new BadRequestException('User already has this role');
    }

    // Prevent changing SUPER_ADMIN or GENERAL_OVERSEER roles
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.GENERAL_OVERSEER) {
      throw new BadRequestException('Cannot change the role of this user');
    }

    // Create role-specific profile if needed
    if (newRole === UserRole.REALTOR && !user.realtorProfile) {
      const { v4: uuidv4 } = await import('uuid');
      await this.prisma.realtorProfile.create({
        data: {
          userId: user.id,
          licenseNumber: `LIC-${uuidv4().substring(0, 8).toUpperCase()}`,
          specializations: [],
        },
      });
    } else if (newRole === UserRole.CLIENT && !user.clientProfile) {
      await this.prisma.clientProfile.create({
        data: { userId: user.id },
      });
    } else if ((newRole === UserRole.ADMIN || newRole === UserRole.GENERAL_OVERSEER) && !user.adminProfile) {
      await this.prisma.adminProfile.create({
        data: {
          userId: user.id,
          permissions: ['all'],
        },
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    return updatedUser;
  }

  async getStats() {
    const excludeSuperAdmin = { role: { not: UserRole.SUPER_ADMIN } };
    const [totalUsers, activeUsers, realtors, clients, admins] = await Promise.all([
      this.prisma.user.count({ where: excludeSuperAdmin }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, ...excludeSuperAdmin } }),
      this.prisma.user.count({ where: { role: UserRole.REALTOR } }),
      this.prisma.user.count({ where: { role: UserRole.CLIENT } }),
      this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      realtors,
      clients,
      admins,
    };
  }
}
