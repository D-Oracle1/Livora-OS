import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/services/mail.service';
import { QueueService } from '../../common/services/queue.service';
import { ConfigService } from '@nestjs/config';
import { SendNewsletterDto } from './dto/newsletter.dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  async subscribe(email: string, name?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (existing.isActive) {
        return { message: 'You are already subscribed!' };
      }
      // Reactivate
      await this.prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { isActive: true, unsubscribedAt: null, name: name || existing.name },
      });
      return { message: 'Welcome back! Your subscription has been reactivated.' };
    }

    await this.prisma.newsletterSubscriber.create({
      data: { email: normalizedEmail, name },
    });

    return { message: 'Successfully subscribed to our newsletter!' };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid unsubscribe link.');
    }

    if (!subscriber.isActive) {
      return { message: 'You are already unsubscribed.' };
    }

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false, unsubscribedAt: new Date() },
    });

    return { message: 'You have been successfully unsubscribed.' };
  }

  async getSubscribers(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status === 'active') where.isActive = true;
    else if (status === 'unsubscribed') where.isActive = false;

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [subscribers, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        skip,
        take: limit,
        orderBy: { subscribedAt: 'desc' },
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);

    return {
      data: subscribers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats() {
    const [total, active, unsubscribed] = await Promise.all([
      this.prisma.newsletterSubscriber.count(),
      this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      this.prisma.newsletterSubscriber.count({ where: { isActive: false } }),
    ]);

    return { total, active, unsubscribed };
  }

  async deleteSubscriber(id: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!subscriber) throw new NotFoundException('Subscriber not found');

    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    return { message: 'Subscriber deleted' };
  }

  async getRecipients(type: 'SUBSCRIBERS' | 'CLIENTS' | 'STAFF' | 'REALTORS') {
    switch (type) {
      case 'SUBSCRIBERS': {
        const rows = await this.prisma.newsletterSubscriber.findMany({
          where: { isActive: true },
          select: { email: true, name: true },
          orderBy: { subscribedAt: 'desc' },
        });
        return { count: rows.length, data: rows };
      }
      case 'CLIENTS': {
        const rows = await this.prisma.user.findMany({
          where: { role: UserRole.CLIENT, status: UserStatus.ACTIVE },
          select: { email: true, firstName: true, lastName: true },
          orderBy: { createdAt: 'desc' },
        });
        return {
          count: rows.length,
          data: rows.map((u) => ({ email: u.email, name: `${u.firstName} ${u.lastName}`.trim() })),
        };
      }
      case 'STAFF': {
        const rows = await this.prisma.user.findMany({
          where: { role: { in: [UserRole.STAFF, UserRole.HR] }, status: UserStatus.ACTIVE },
          select: { email: true, firstName: true, lastName: true },
          orderBy: { createdAt: 'desc' },
        });
        return {
          count: rows.length,
          data: rows.map((u) => ({ email: u.email, name: `${u.firstName} ${u.lastName}`.trim() })),
        };
      }
      case 'REALTORS': {
        const rows = await this.prisma.user.findMany({
          where: { role: UserRole.REALTOR, status: UserStatus.ACTIVE },
          select: { email: true, firstName: true, lastName: true },
          orderBy: { createdAt: 'desc' },
        });
        return {
          count: rows.length,
          data: rows.map((u) => ({ email: u.email, name: `${u.firstName} ${u.lastName}`.trim() })),
        };
      }
    }
  }

  async getCounts() {
    const [subscribers, clients, staff, realtors] = await Promise.all([
      this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.CLIENT, status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { role: { in: [UserRole.STAFF, UserRole.HR] }, status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { role: UserRole.REALTOR, status: UserStatus.ACTIVE } }),
    ]);
    return { subscribers, clients, staff, realtors };
  }

  async sendBulkEmail(dto: SendNewsletterDto) {
    const { subject, content, recipientType = 'SUBSCRIBERS', specificEmails, attachments, branding } = dto;

    const apiUrl = (this.configService.get<string>('API_URL') || 'http://localhost:4000').trim();

    let recipients: { email: string; name?: string | null; unsubscribeToken?: string }[] = [];

    if (recipientType === 'CUSTOM') {
      if (!specificEmails || specificEmails.length === 0) {
        return { message: 'No recipients specified', sent: 0 };
      }
      recipients = specificEmails.map((email) => ({ email }));
    } else {
      const result = await this.getRecipients(recipientType as any);
      recipients = result.data as any;
    }

    if (recipients.length === 0) {
      return { message: 'No recipients to send to', sent: 0 };
    }

    let queued = 0;
    for (const recipient of recipients) {
      const unsubscribeToken = (recipient as any).unsubscribeToken;
      const unsubscribeUrl = unsubscribeToken
        ? `${apiUrl}/api/v1/newsletter/unsubscribe/${unsubscribeToken}`
        : `${apiUrl}/api/v1/newsletter/unsubscribe/noop`;

      try {
        await this.queueService.addEmailJob({
          type: 'newsletter',
          to: recipient.email,
          data: { subject, content, unsubscribeUrl, branding, attachments },
        });
        queued++;
      } catch (error) {
        this.logger.error(`Failed to queue newsletter for ${recipient.email}: ${error.message}`);
      }
    }

    this.logger.log(`Newsletter "${subject}" queued for ${queued}/${recipients.length} recipients (type: ${recipientType})`);
    return { message: `Newsletter queued for ${queued} recipients`, sent: queued };
  }
}
