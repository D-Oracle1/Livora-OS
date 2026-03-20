import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/services/mail.service';
import { NotificationService } from '../notification/notification.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { NotificationType, NotificationPriority } from '@prisma/client';

@Injectable()
export class RaffleService {
  private readonly logger = new Logger(RaffleService.name);
  private readonly CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous O/0 I/1

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Unique code generator ──────────────────────────────────────────────────

  private generateCode(prefix: string, length: number): string {
    const suffix = Array.from({ length }, () =>
      this.CHARS[Math.floor(Math.random() * this.CHARS.length)],
    ).join('');
    return `${prefix.toUpperCase()}-${suffix}`;
  }

  private async generateUniqueCode(prefix: string, length: number): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode(prefix, length);
      const exists = await this.prisma.raffleCode.findUnique({ where: { code } });
      if (!exists) return code;
    }
    // Fallback: increase length to guarantee uniqueness
    return this.generateCode(prefix, length + 2);
  }

  // ── Eligible user query ────────────────────────────────────────────────────

  private buildUserWhere(dto: Pick<CreateRaffleDto, 'targetRoles' | 'joinedAfter' | 'joinedBefore'>) {
    const where: any = { status: 'ACTIVE' };
    if (dto.targetRoles && dto.targetRoles.length > 0) {
      where.role = { in: dto.targetRoles };
    }
    if (dto.joinedAfter || dto.joinedBefore) {
      where.createdAt = {};
      if (dto.joinedAfter) where.createdAt.gte = new Date(dto.joinedAfter);
      if (dto.joinedBefore) where.createdAt.lte = new Date(dto.joinedBefore);
    }
    return where;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateRaffleDto, adminId: string) {
    const clean = (dto.codePrefix || 'RAFFLE').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) throw new BadRequestException('Code prefix must contain letters or numbers');

    return this.prisma.raffleSession.create({
      data: {
        name: dto.name,
        description: dto.description,
        codePrefix: clean,
        codeLength: dto.codeLength ?? 6,
        targetRoles: dto.targetRoles ?? [],
        joinedAfter: dto.joinedAfter ? new Date(dto.joinedAfter) : null,
        joinedBefore: dto.joinedBefore ? new Date(dto.joinedBefore) : null,
        createdBy: adminId,
      },
    });
  }

  async findAll() {
    const sessions = await this.prisma.raffleSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { codes: true } } },
    });
    return sessions;
  }

  async findOne(id: string) {
    const session = await this.prisma.raffleSession.findUnique({
      where: { id },
      include: { _count: { select: { codes: true } } },
    });
    if (!session) throw new NotFoundException('Raffle session not found');
    return session;
  }

  async previewEligible(id: string) {
    const session = await this.findOne(id);
    const where = this.buildUserWhere({
      targetRoles: session.targetRoles,
      joinedAfter: session.joinedAfter?.toISOString(),
      joinedBefore: session.joinedBefore?.toISOString(),
    });

    const [count, sample] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { count, sample };
  }

  async send(id: string) {
    const session = await this.findOne(id);
    if (session.status === 'SENT') {
      throw new BadRequestException('Codes have already been sent for this session');
    }

    const where = this.buildUserWhere({
      targetRoles: session.targetRoles,
      joinedAfter: session.joinedAfter?.toISOString(),
      joinedBefore: session.joinedBefore?.toISOString(),
    });

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (users.length === 0) {
      throw new BadRequestException('No eligible users found matching the selected criteria');
    }

    // Generate codes and persist in batches
    const now = new Date();
    const codeRecords: Array<{ sessionId: string; userId: string; code: string; sentAt: Date }> = [];

    for (const user of users) {
      // Skip users who already have a code for this session
      const exists = await this.prisma.raffleCode.findFirst({
        where: { sessionId: id, userId: user.id },
        select: { id: true },
      });
      if (exists) continue;

      const code = await this.generateUniqueCode(session.codePrefix, session.codeLength);
      codeRecords.push({ sessionId: id, userId: user.id, code, sentAt: now });
    }

    if (codeRecords.length === 0) {
      throw new BadRequestException('All eligible users already have codes for this session');
    }

    await this.prisma.raffleCode.createMany({ data: codeRecords });

    // Update session status
    await this.prisma.raffleSession.update({
      where: { id },
      data: { status: 'SENT', sentAt: now, totalSent: { increment: codeRecords.length } },
    });

    // Send emails + notifications concurrently (fire-and-forget individual failures)
    const emailJobs = codeRecords.map(async (record) => {
      const user = users.find((u) => u.id === record.userId);
      if (!user) return;

      const emailHtml = this.buildRaffleEmail(user.firstName, session.name, record.code, session.description);

      try {
        await this.mail.sendRaffleCodeEmail(user.email, session.name, emailHtml);
      } catch (err) {
        this.logger.error(`Failed to email raffle code to ${user.email}: ${err.message}`);
      }

      try {
        await this.notifications.create({
          userId: user.id,
          type: 'RAFFLE' as NotificationType,
          title: `🎟️ Your Raffle Code for "${session.name}"`,
          message: `Your unique raffle code is: ${record.code}`,
          priority: NotificationPriority.HIGH,
          data: { sessionId: id, code: record.code },
        });
      } catch (err) {
        this.logger.error(`Failed to notify ${user.id}: ${err.message}`);
      }
    });

    await Promise.allSettled(emailJobs);

    return { sent: codeRecords.length, sessionId: id };
  }

  async getCodes(id: string, page = 1, limit = 50) {
    await this.findOne(id);
    const skip = (page - 1) * limit;

    const [codes, total] = await Promise.all([
      this.prisma.raffleCode.findMany({
        where: { sessionId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      }),
      this.prisma.raffleCode.count({ where: { sessionId: id } }),
    ]);

    return { data: codes, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async markRedeemed(code: string) {
    const record = await this.prisma.raffleCode.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('Raffle code not found');
    if (record.redeemedAt) throw new BadRequestException('Code has already been redeemed');
    return this.prisma.raffleCode.update({
      where: { code },
      data: { redeemedAt: new Date() },
    });
  }

  async completeSession(id: string) {
    await this.findOne(id);
    return this.prisma.raffleSession.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.raffleSession.delete({ where: { id } });
    return { message: 'Raffle session deleted' };
  }

  // ── Email HTML builder ────────────────────────────────────────────────────

  private buildRaffleEmail(firstName: string, sessionName: string, code: string, description?: string | null): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">🎟️ You've Received a Raffle Code!</h2>
        <p>Hi <strong>${firstName}</strong>,</p>
        <p>You have been selected to receive a raffle code for <strong>${sessionName}</strong>.</p>
        ${description ? `<p style="color:#64748b;">${description}</p>` : ''}
        <div style="background:#f8fafc;border:2px dashed #3b82f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Your unique raffle code</p>
          <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:6px;color:#1e40af;font-family:monospace;">${code}</p>
        </div>
        <p style="color:#64748b;font-size:13px;">Keep this code safe — you may be asked to present it during the raffle draw.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="color:#999;font-size:12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;
  }
}
