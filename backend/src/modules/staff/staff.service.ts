import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { StaffPosition, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createStaffDto: CreateStaffDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createStaffDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if employee ID already exists
    const existingEmployee = await this.prisma.staffProfile.findUnique({
      where: { employeeId: createStaffDto.employeeId },
    });

    if (existingEmployee) {
      throw new ConflictException('Employee ID already exists');
    }

    // Check if department exists
    const department = await this.prisma.department.findUnique({
      where: { id: createStaffDto.departmentId },
      select: { id: true, role: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Check if manager exists (if provided)
    if (createStaffDto.managerId) {
      const manager = await this.prisma.staffProfile.findUnique({
        where: { id: createStaffDto.managerId },
      });

      if (!manager) {
        throw new NotFoundException('Manager not found');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createStaffDto.password, 12);

    // Create user and staff profile in transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: createStaffDto.email,
          password: hashedPassword,
          firstName: createStaffDto.firstName,
          lastName: createStaffDto.lastName,
          phone: createStaffDto.phone,
          role: department.role ?? UserRole.STAFF,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });

      const staffProfile = await prisma.staffProfile.create({
        data: {
          userId: user.id,
          employeeId: createStaffDto.employeeId,
          position: createStaffDto.position,
          title: createStaffDto.title,
          employmentType: createStaffDto.employmentType,
          hireDate: new Date(createStaffDto.hireDate),
          departmentId: createStaffDto.departmentId,
          managerId: createStaffDto.managerId,
          baseSalary: createStaffDto.baseSalary,
          currency: createStaffDto.currency || 'NGN',
          roleId: createStaffDto.roleId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              status: true,
            },
          },
          department: true,
          manager: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          staffRole: true,
        },
      });

      return staffProfile;
    });

    return result;
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    position?: StaffPosition;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      departmentId,
      position,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (position) {
      where.position = position;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.user = { firstName: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [staff, total] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              status: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          manager: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              directReports: true,
              tasksAssigned: true,
            },
          },
        },
      }),
      this.prisma.staffProfile.count({ where }),
    ]);

    return {
      data: staff,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            status: true,
            createdAt: true,
          },
        },
        department: true,
        manager: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        permissions: true,
        staffRole: true,
        _count: {
          select: {
            directReports: true,
            tasksAssigned: true,
            tasksCreated: true,
            leaveRequests: true,
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  async getMyProfile(userId: string) {
    // Returns null instead of throwing if the user has no staff profile
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        employeeId: true,
        position: true,
        title: true,
        isActive: true,
        department: {
          select: {
            id: true,
            name: true,
            role: true,
            allowedModules: true,
          },
        },
      },
    });
    return staff;
  }

  async findByUserId(userId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            status: true,
          },
        },
        department: true,
        manager: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        permissions: true,
        staffRole: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found');
    }

    return staff;
  }

  async getDashboard(userId: string) {
    const staff = await this.findByUserId(userId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [
      pendingTasks,
      completedTasksThisMonth,
      pendingLeaveRequests,
      upcomingReviews,
      recentAttendance,
      teamMembers,
    ] = await Promise.all([
      // Pending tasks count
      this.prisma.staffTask.count({
        where: {
          assigneeId: staff.id,
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      // Completed tasks this month
      this.prisma.staffTask.count({
        where: {
          assigneeId: staff.id,
          status: 'COMPLETED',
          completedAt: { gte: startOfMonth },
        },
      }),
      // Pending leave requests
      this.prisma.leaveRequest.count({
        where: {
          staffProfileId: staff.id,
          status: 'PENDING',
        },
      }),
      // Upcoming performance reviews
      this.prisma.performanceReview.findMany({
        where: {
          revieweeId: staff.id,
          status: { in: ['DRAFT', 'IN_PROGRESS'] },
        },
        take: 3,
        orderBy: { periodEnd: 'asc' },
      }),
      // Recent attendance (last 7 days)
      this.prisma.attendance.findMany({
        where: {
          staffProfileId: staff.id,
          date: { gte: startOfWeek },
        },
        orderBy: { date: 'desc' },
        take: 7,
      }),
      // Team members (direct reports)
      this.prisma.staffProfile.count({
        where: { managerId: staff.id },
      }),
    ]);

    return {
      profile: staff,
      stats: {
        pendingTasks,
        completedTasksThisMonth,
        pendingLeaveRequests,
        teamMembers,
        annualLeaveBalance: staff.annualLeaveBalance,
        sickLeaveBalance: staff.sickLeaveBalance,
      },
      upcomingReviews,
      recentAttendance,
    };
  }

  async update(id: string, updateStaffDto: UpdateStaffDto) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    // Update user fields if provided
    const userUpdate: any = {};
    if (updateStaffDto.firstName) userUpdate.firstName = updateStaffDto.firstName;
    if (updateStaffDto.lastName) userUpdate.lastName = updateStaffDto.lastName;
    if (updateStaffDto.phone) userUpdate.phone = updateStaffDto.phone;

    // If department is changing, also update the user's role to match new department
    if (updateStaffDto.departmentId && updateStaffDto.departmentId !== staff.departmentId) {
      const newDept = await this.prisma.department.findUnique({
        where: { id: updateStaffDto.departmentId },
        select: { role: true },
      });
      if (newDept) {
        userUpdate.role = newDept.role ?? UserRole.STAFF;
      }
    }

    // Update staff profile fields
    const staffUpdate: any = {};
    if (updateStaffDto.position) staffUpdate.position = updateStaffDto.position;
    if (updateStaffDto.title) staffUpdate.title = updateStaffDto.title;
    if (updateStaffDto.employmentType) staffUpdate.employmentType = updateStaffDto.employmentType;
    if (updateStaffDto.departmentId) staffUpdate.departmentId = updateStaffDto.departmentId;
    if (updateStaffDto.managerId !== undefined) staffUpdate.managerId = updateStaffDto.managerId;
    if (updateStaffDto.baseSalary) staffUpdate.baseSalary = updateStaffDto.baseSalary;
    if (typeof updateStaffDto.isActive === 'boolean') staffUpdate.isActive = updateStaffDto.isActive;
    if (updateStaffDto.terminationDate) staffUpdate.terminationDate = new Date(updateStaffDto.terminationDate);
    if (updateStaffDto.annualLeaveBalance !== undefined) staffUpdate.annualLeaveBalance = updateStaffDto.annualLeaveBalance;
    if (updateStaffDto.sickLeaveBalance !== undefined) staffUpdate.sickLeaveBalance = updateStaffDto.sickLeaveBalance;
    if (updateStaffDto.roleId !== undefined) staffUpdate.roleId = updateStaffDto.roleId;
    if (typeof updateStaffDto.isTaxable === 'boolean') staffUpdate.isTaxable = updateStaffDto.isTaxable;

    const result = await this.prisma.$transaction(async (prisma) => {
      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({
          where: { id: staff.userId },
          data: userUpdate,
        });
      }

      return prisma.staffProfile.update({
        where: { id },
        data: staffUpdate,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              status: true,
            },
          },
          department: true,
        },
      });
    });

    return result;
  }

  async deactivate(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.user.update({
        where: { id: staff.userId },
        data: { status: UserStatus.INACTIVE },
      });

      return prisma.staffProfile.update({
        where: { id },
        data: {
          isActive: false,
          terminationDate: new Date(),
        },
      });
    });
  }

  async getDirectReports(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return this.prisma.staffProfile.findMany({
      where: { managerId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            status: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async getTeamHierarchy(id: string) {
    // Get all reports recursively
    const getReportsRecursive = async (managerId: string, level: number = 0): Promise<any[]> => {
      const reports = await this.prisma.staffProfile.findMany({
        where: { managerId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
        },
      });

      const result = [];
      for (const report of reports) {
        const children = await getReportsRecursive(report.id, level + 1);
        result.push({
          ...report,
          level,
          children,
        });
      }
      return result;
    };

    return getReportsRecursive(id);
  }

  async assignManager(id: string, managerId: string | null) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (managerId) {
      const manager = await this.prisma.staffProfile.findUnique({
        where: { id: managerId },
      });

      if (!manager) {
        throw new NotFoundException('Manager not found');
      }

      // Prevent circular reporting
      if (managerId === id) {
        throw new BadRequestException('Staff member cannot be their own manager');
      }
    }

    return this.prisma.staffProfile.update({
      where: { id },
      data: { managerId },
      include: {
        manager: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  // Permission management
  async getPermissions(staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
      include: {
        permissions: true,
        staffRole: true,
      },
    });

    if (!staff) throw new NotFoundException('Staff member not found');

    const individual = staff.permissions;
    const rolePerms: any[] = staff.staffRole
      ? ((staff.staffRole.permissions as any[]) ?? []).map((p: any) => ({
          ...p,
          fromRole: true,
          roleName: staff.staffRole!.name,
        }))
      : [];

    return { individual, fromRole: rolePerms, role: staff.staffRole };
  }

  async assignPermission(staffProfileId: string, dto: AssignPermissionDto) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return this.prisma.staffPermission.upsert({
      where: {
        staffProfileId_resource_action: {
          staffProfileId,
          resource: dto.resource,
          action: dto.action,
        },
      },
      update: {
        scope: dto.scope,
      },
      create: {
        staffProfileId,
        resource: dto.resource,
        action: dto.action,
        scope: dto.scope,
      },
    });
  }

  async removePermission(staffProfileId: string, permissionId: string) {
    const permission = await this.prisma.staffPermission.findUnique({
      where: { id: permissionId },
    });

    if (!permission || permission.staffProfileId !== staffProfileId) {
      throw new NotFoundException('Permission not found');
    }

    return this.prisma.staffPermission.delete({
      where: { id: permissionId },
    });
  }

  async hasPermission(staffProfileId: string, resource: string, action: string): Promise<boolean> {
    // Check individual permission record
    const permission = await this.prisma.staffPermission.findFirst({
      where: {
        staffProfileId,
        resource,
        OR: [
          { action },
          { action: 'manage' }, // 'manage' grants all actions
        ],
      },
    });

    if (permission) return true;

    // Check role-based permissions
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
      include: { staffRole: true },
    });

    if (staff?.staffRole) {
      const rolePerms = (staff.staffRole.permissions as any[]) ?? [];
      return rolePerms.some(
        (p: any) =>
          p.resource === resource && (p.action === action || p.action === 'manage'),
      );
    }

    return false;
  }
}
