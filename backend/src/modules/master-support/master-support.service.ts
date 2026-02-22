import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { MasterPrismaService } from '../../database/master-prisma.service';

@Injectable()
export class MasterSupportService {
  constructor(private readonly masterPrisma: MasterPrismaService) {}

  async getOrCreateThread(companyId: string) {
    const existing = await this.masterPrisma.supportThread.findUnique({
      where: { companyId },
      include: {
        company: { select: { id: true, name: true, logo: true, domain: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (existing) return existing;

    return this.masterPrisma.supportThread.create({
      data: { companyId },
      include: {
        company: { select: { id: true, name: true, logo: true, domain: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async getMessages(threadId: string, companyId?: string) {
    const thread = await this.masterPrisma.supportThread.findUnique({
      where: { id: threadId },
      select: { id: true, companyId: true },
    });

    if (!thread) throw new NotFoundException('Support thread not found');
    if (companyId && thread.companyId !== companyId) throw new ForbiddenException();

    return this.masterPrisma.supportMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(
    threadId: string,
    content: string,
    senderType: string,
    senderId: string,
    senderName: string,
    companyId?: string,
  ) {
    const thread = await this.masterPrisma.supportThread.findUnique({
      where: { id: threadId },
      select: { id: true, companyId: true },
    });

    if (!thread) throw new NotFoundException('Support thread not found');
    if (companyId && thread.companyId !== companyId) throw new ForbiddenException();

    const [message] = await this.masterPrisma.$transaction([
      this.masterPrisma.supportMessage.create({
        data: { threadId, content, senderType, senderId, senderName },
      }),
      this.masterPrisma.supportThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return message;
  }

  async getAllThreads() {
    return this.masterPrisma.supportThread.findMany({
      include: {
        company: { select: { id: true, name: true, logo: true, domain: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async markThreadResolved(threadId: string) {
    return this.masterPrisma.supportThread.update({
      where: { id: threadId },
      data: { status: 'resolved' },
    });
  }
}
