import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, AddCommentDto, SubmitReportDto } from './dto/update-task.dto';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { PolicyService } from '../hr/services/policy.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  async create(creatorUserId: string, dto: CreateTaskDto) {
    // Look up staff profile — admins may not have one
    const creator = await this.prisma.staffProfile.findUnique({
      where: { userId: creatorUserId },
    });

    const assignee = await this.prisma.staffProfile.findUnique({
      where: { id: dto.assigneeId },
    });

    if (!assignee) {
      throw new NotFoundException('Assignee not found');
    }

    return this.prisma.staffTask.create({
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        creatorId: creator?.id || undefined,
        createdByUserId: creatorUserId,
        priority: dto.priority || TaskPriority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        tags: dto.tags || [],
        propertyId: dto.propertyId,
        saleId: dto.saleId,
      },
      include: {
        assignee: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
        },
        creator: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    assigneeId?: string;
    creatorId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    search?: string;
  }) {
    const { page = 1, limit = 20, assigneeId, creatorId, status, priority, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (assigneeId) where.assigneeId = assigneeId;
    if (creatorId) where.creatorId = creatorId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.staffTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          assignee: {
            include: {
              user: {
                select: { firstName: true, lastName: true, avatar: true },
              },
            },
          },
          creator: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      }),
      this.prisma.staffTask.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const task = await this.prisma.staffTask.findUnique({
      where: { id },
      include: {
        assignee: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true, avatar: true },
            },
            department: {
              select: { name: true },
            },
          },
        },
        creator: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Enrich comments with author names (authorId is a plain User ID string)
    if (task.comments.length > 0) {
      const authorIds = [...new Set(task.comments.map((c) => c.authorId))];
      const authors = await this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, firstName: true, lastName: true, avatar: true },
      });
      const authorMap = Object.fromEntries(authors.map((u) => [u.id, u]));
      const enrichedComments = task.comments.map((c) => ({
        ...c,
        author: authorMap[c.authorId] || null,
      }));
      return { ...task, comments: enrichedComments };
    }

    return task;
  }

  async getMyTasks(userId: string, query: { status?: TaskStatus }) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const where: any = { assigneeId: staffProfile.id };
    if (query.status) where.status = query.status;

    return this.prisma.staffTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      include: {
        creator: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    });
  }

  async getTasksCreatedByMe(userId: string) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.prisma.staffTask.findMany({
      where: { creatorId: staffProfile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto, userRole?: string) {
    const task = await this.prisma.staffTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Staff cannot mark tasks as completed — must submit for review
    if (userRole === 'STAFF' && dto.status === TaskStatus.COMPLETED) {
      throw new ForbiddenException('Staff cannot mark tasks as completed directly. Submit for review instead.');
    }

    const data: any = { ...dto };
    const now = new Date();
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);

    // Mark as completed if status is COMPLETED
    if (dto.status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
      data.completedAt = now;
    }

    const updated = await this.prisma.staffTask.update({
      where: { id },
      data,
      include: {
        assignee: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
        },
      },
    });

    // Auto-trigger late task penalty if completed after due date
    if (
      dto.status === TaskStatus.COMPLETED &&
      task.status !== TaskStatus.COMPLETED &&
      task.dueDate &&
      now > task.dueDate
    ) {
      const daysLate = Math.ceil((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      try {
        await this.policyService.calculateLateTaskPenalty(
          task.assigneeId,
          task.id,
          daysLate,
        );
      } catch (error) {
        console.error('Failed to calculate late task penalty:', error);
      }
    }

    // Notify staff when their task is approved
    if (dto.status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
      try {
        const assignee = await this.prisma.staffProfile.findUnique({
          where: { id: task.assigneeId },
          select: { userId: true },
        });
        if (assignee) {
          await this.notificationService.create({
            userId: assignee.userId,
            type: 'TASK_COMPLETED',
            title: 'Task Approved',
            message: `Your task "${task.title}" has been approved and marked as completed.`,
            link: '/dashboard/staff/tasks',
          });
        }
      } catch (error) {
        console.error('Failed to send task approval notification:', error);
      }
    }

    return updated;
  }

  async updateStatus(id: string, status: TaskStatus, userRole?: string) {
    const task = await this.prisma.staffTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Staff cannot mark tasks as completed — must submit for review
    if (userRole === 'STAFF' && status === TaskStatus.COMPLETED) {
      throw new ForbiddenException('Staff cannot mark tasks as completed directly. Submit for review instead.');
    }

    const data: any = { status };
    const now = new Date();

    if (status === TaskStatus.COMPLETED) {
      data.completedAt = now;
    } else if (task.status === TaskStatus.COMPLETED) {
      data.completedAt = null;
    }

    const updated = await this.prisma.staffTask.update({
      where: { id },
      data,
    });

    // Auto-trigger late task penalty if completed after due date
    if (
      status === TaskStatus.COMPLETED &&
      task.status !== TaskStatus.COMPLETED &&
      task.dueDate &&
      now > task.dueDate
    ) {
      const daysLate = Math.ceil((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      try {
        await this.policyService.calculateLateTaskPenalty(
          task.assigneeId,
          task.id,
          daysLate,
        );
      } catch (error) {
        console.error('Failed to calculate late task penalty:', error);
      }
    }

    // Notify staff when their task is approved
    if (status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
      try {
        const assignee = await this.prisma.staffProfile.findUnique({
          where: { id: task.assigneeId },
          select: { userId: true },
        });
        if (assignee) {
          await this.notificationService.create({
            userId: assignee.userId,
            type: 'TASK_COMPLETED',
            title: 'Task Approved',
            message: `Your task "${task.title}" has been approved and marked as completed.`,
            link: '/dashboard/staff/tasks',
          });
        }
      } catch (error) {
        console.error('Failed to send task approval notification:', error);
      }
    }

    return updated;
  }

  async submitReport(id: string, userId: string, dto: SubmitReportDto) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const task = await this.prisma.staffTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.assigneeId !== staffProfile.id) {
      throw new ForbiddenException('You can only submit reports for your own tasks');
    }

    if (task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.TODO) {
      throw new ForbiddenException('Task must be in progress or to-do to submit a report');
    }

    const updated = await this.prisma.staffTask.update({
      where: { id },
      data: {
        status: TaskStatus.IN_REVIEW,
        reportDescription: dto.description || null,
        reportLinks: dto.links || [],
        attachments: dto.attachments || [],
      },
      include: {
        assignee: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
        },
      },
    });

    // Notify task creator that a report has been submitted
    if (task.createdByUserId) {
      try {
        await this.notificationService.create({
          userId: task.createdByUserId,
          type: 'SYSTEM',
          title: 'Task Report Submitted',
          message: `Report submitted for "${task.title}" and is ready for review.`,
          link: '/dashboard/admin/hr/tasks',
        });
      } catch (error) {
        console.error('Failed to send report notification:', error);
      }
    }

    return updated;
  }

  async delete(id: string) {
    const task = await this.prisma.staffTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.staffTask.delete({
      where: { id },
    });
  }

  async getComments(taskId: string) {
    const task = await this.prisma.staffTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });

    if (comments.length === 0) return comments;

    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true, avatar: true },
    });
    const authorMap = Object.fromEntries(authors.map((u) => [u.id, u]));
    return comments.map((c) => ({ ...c, author: authorMap[c.authorId] || null }));
  }

  async addComment(taskId: string, authorId: string, dto: AddCommentDto) {
    const task = await this.prisma.staffTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        content: dto.content,
        attachments: dto.attachments || [],
      },
    });
  }

  async getTaskStats(userId: string) {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    const [total, byStatus, overdue] = await Promise.all([
      this.prisma.staffTask.count({
        where: { assigneeId: staffProfile.id },
      }),
      this.prisma.staffTask.groupBy({
        by: ['status'],
        where: { assigneeId: staffProfile.id },
        _count: { id: true },
      }),
      this.prisma.staffTask.count({
        where: {
          assigneeId: staffProfile.id,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.BLOCKED] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      todo: statusCounts[TaskStatus.TODO] || 0,
      inProgress: statusCounts[TaskStatus.IN_PROGRESS] || 0,
      inReview: statusCounts[TaskStatus.IN_REVIEW] || 0,
      completed: statusCounts[TaskStatus.COMPLETED] || 0,
      blocked: statusCounts[TaskStatus.BLOCKED] || 0,
      overdue,
    };
  }
}
