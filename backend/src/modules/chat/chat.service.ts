import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessageType, UserRole } from '@prisma/client';
import { RealtimeService } from '../../common/services/realtime.service';
import { CrmService } from './crm.service';

// Default chat zone policies: which roles each role can chat with
// SUPER_ADMIN is intentionally excluded from all tenant-visible role lists —
// tenants see GENERAL_OVERSEER as the highest authority.
const DEFAULT_CHAT_ZONES: Record<string, UserRole[]> = {
  SUPER_ADMIN: [UserRole.SUPER_ADMIN, UserRole.GENERAL_OVERSEER, UserRole.ADMIN, UserRole.STAFF, UserRole.REALTOR, UserRole.CLIENT],
  GENERAL_OVERSEER: [UserRole.GENERAL_OVERSEER, UserRole.ADMIN, UserRole.STAFF, UserRole.REALTOR, UserRole.CLIENT],
  ADMIN: [UserRole.GENERAL_OVERSEER, UserRole.ADMIN, UserRole.STAFF, UserRole.REALTOR, UserRole.CLIENT],
  STAFF: [UserRole.STAFF, UserRole.ADMIN, UserRole.GENERAL_OVERSEER],
  REALTOR: [UserRole.REALTOR, UserRole.ADMIN, UserRole.GENERAL_OVERSEER],
  CLIENT: [UserRole.ADMIN, UserRole.STAFF, UserRole.GENERAL_OVERSEER],
};

const MESSAGE_SELECT = {
  id: true,
  roomId: true,
  senderId: true,
  content: true,
  type: true,
  attachments: true,
  metadata: true,
  readBy: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: { id: true, firstName: true, lastName: true, avatar: true },
  },
  voiceMessage: {
    select: { audioUrl: true, duration: true, waveform: true },
  },
} as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly crmService: CrmService,
  ) {}

  async createRoom(creatorId: string, participantIds: string[], name?: string) {
    const allParticipants = [...new Set([creatorId, ...participantIds])];

    if (allParticipants.length < 2) {
      throw new BadRequestException('At least 2 participants required');
    }

    // Check if direct chat already exists between exactly these 2 users
    if (allParticipants.length === 2) {
      const existingRoom = await this.prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { participants: { some: { id: allParticipants[0] } } },
            { participants: { some: { id: allParticipants[1] } } },
            { participants: { every: { id: { in: allParticipants } } } },
          ],
        },
        include: {
          participants: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: MESSAGE_SELECT,
          },
        },
      });

      if (existingRoom) {
        return {
          ...existingRoom,
          lastMessage: existingRoom.messages[0] || null,
          unreadCount: 0,
        };
      }
    }

    const room = await this.prisma.chatRoom.create({
      data: {
        name,
        type: allParticipants.length === 2 ? 'DIRECT' : 'GROUP',
        participants: {
          connect: allParticipants.map((id) => ({ id })),
        },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return { ...room, lastMessage: null, unreadCount: 0 };
  }

  async getRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        participants: { some: { id: userId } },
        type: { not: 'SUPPORT' },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: MESSAGE_SELECT,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r.id);
    const unreadCounts = await this.prisma.message.groupBy({
      by: ['roomId'],
      where: {
        roomId: { in: roomIds },
        senderId: { not: userId },
        NOT: { readBy: { has: userId } },
      },
      _count: { id: true },
    });

    const unreadMap = new Map(unreadCounts.map((u) => [u.roomId, u._count.id]));

    return rooms.map((room) => ({
      ...room,
      lastMessage: room.messages[0] || null,
      unreadCount: unreadMap.get(room.id) || 0,
    }));
  }

  async getRoom(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        participants: { some: { id: userId } },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
      },
    });

    if (!room) throw new NotFoundException('Chat room not found');
    return room;
  }

  /**
   * Optimised message pagination.
   *
   * Access check: one fast COUNT on chatRoom (primary-key lookup + EXISTS on join table).
   * Message fetch:  plain WHERE roomId=? — uses composite index (roomId, createdAt DESC).
   *                 No cross-table JOIN on every message row.
   *
   * cursor = ISO timestamp of the OLDEST message already loaded → load older messages.
   */
  async getMessages(
    roomId: string,
    userId: string,
    query: { page?: number; limit?: number; cursor?: string },
  ) {
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));

    // Single fast membership check — no JOIN on the message query itself
    const isMember = await this.prisma.chatRoom.count({
      where: { id: roomId, participants: { some: { id: userId } } },
    });
    if (!isMember) throw new NotFoundException('Chat room not found');

    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (isNaN(cursorDate.getTime())) throw new BadRequestException('Invalid cursor value');

      const messages = await this.prisma.message.findMany({
        where: { roomId, createdAt: { lt: cursorDate } }, // composite index hit
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: MESSAGE_SELECT,
      });

      const reversed = messages.reverse();
      return {
        data: reversed,
        meta: {
          cursor: reversed.length > 0 ? reversed[0].createdAt.toISOString() : null,
          hasMore: messages.length === limit,
          limit,
        },
      };
    }

    // Offset pagination (no COUNT — infer hasMore from result length)
    const page = Math.max(1, Number(query.page) || 1);
    const skip = (page - 1) * limit;

    const messages = await this.prisma.message.findMany({
      where: { roomId },           // composite index hit
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: MESSAGE_SELECT,
    });

    return {
      data: messages.reverse(),
      meta: { page, limit, hasMore: messages.length === limit },
    };
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    data: { content: string; type?: MessageType; attachments?: any[] },
  ) {
    await this.getRoom(roomId, senderId);

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content: data.content,
        type: data.type || MessageType.TEXT,
        attachments: data.attachments,
        readBy: [senderId],
      },
      select: MESSAGE_SELECT,
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });

    await this.broadcastMessage(roomId, senderId, message);

    // CRM: log if a CLIENT is in this room
    const clientId = await this.crmService.resolveClientInRoom(roomId, senderId);
    if (clientId) {
      this.crmService.logActivity({
        agentId: senderId,
        clientId,
        activityType: 'chat',
        referenceId: roomId,
        notes: data.content.slice(0, 200),
      }).catch(() => {});
      this.crmService.updateEngagement(clientId, data.content).catch(() => {});
    }

    return message;
  }

  /** Send a voice note message — requires pre-processed voice data from VoiceService */
  async sendVoiceMessage(
    roomId: string,
    senderId: string,
    voiceData: { audioUrl: string; duration: number; waveform: number[] },
  ) {
    await this.getRoom(roomId, senderId);

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content: `🎤 Voice note (${voiceData.duration}s)`,
        type: MessageType.VOICE,
        readBy: [senderId],
        metadata: {
          audioUrl: voiceData.audioUrl,
          duration: voiceData.duration,
          waveform: voiceData.waveform,
        },
        voiceMessage: {
          create: {
            audioUrl: voiceData.audioUrl,
            duration: voiceData.duration,
            waveform: voiceData.waveform,
          },
        },
      },
      select: MESSAGE_SELECT,
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });

    await this.broadcastMessage(roomId, senderId, message);

    // CRM: log voice note
    const clientId = await this.crmService.resolveClientInRoom(roomId, senderId);
    if (clientId) {
      this.crmService.logActivity({
        agentId: senderId,
        clientId,
        activityType: 'voice_note',
        referenceId: message.id,
        notes: `Voice note (${voiceData.duration}s)`,
      }).catch(() => {});
      this.crmService.updateEngagement(clientId, `Voice note (${voiceData.duration}s)`).catch(() => {});
    }

    return message;
  }

  async markAsRead(roomId: string, userId: string) {
    await this.getRoom(roomId, userId);
    await this.prisma.message.updateMany({
      where: { roomId, NOT: { readBy: { has: userId } } },
      data: { readBy: { push: userId } },
    });
    return { success: true };
  }

  /** Broadcast typing indicator via Supabase Realtime */
  async broadcastTyping(roomId: string, userId: string, isTyping: boolean) {
    try {
      await this.realtimeService.sendToChatRoom(roomId, 'chat:typing', {
        roomId,
        userId,
        isTyping,
      });
    } catch {
      // Non-critical
    }
    return { success: true };
  }

  private getAllowedRoles(callerRole: string): UserRole[] {
    return DEFAULT_CHAT_ZONES[callerRole] || [UserRole.ADMIN];
  }

  async searchUsers(currentUserId: string, callerRole: string, search: string) {
    if (!search || search.trim().length < 2) return [];

    const allowedRoles = this.getAllowedRoles(callerRole);

    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: 'ACTIVE',
        role: { in: allowedRoles },
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true },
      take: 20,
    });
  }

  async getContacts(currentUserId: string, callerRole: string) {
    const allowedRoles = this.getAllowedRoles(callerRole);

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: 'ACTIVE',
        role: { in: allowedRoles },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: 100,
    });

    const grouped: Record<string, typeof users> = {};
    for (const user of users) {
      const role = user.role;
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(user);
    }

    return { contacts: users, grouped };
  }

  async deleteRoom(roomId: string, userId: string) {
    await this.getRoom(roomId, userId);
    await this.prisma.chatRoom.delete({ where: { id: roomId } });
    return { message: 'Chat room deleted' };
  }

  async addParticipants(roomId: string, userId: string, participantIds: string[]) {
    const room = await this.getRoom(roomId, userId);
    if (room.type === 'DIRECT') throw new BadRequestException('Cannot add participants to direct chat');

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { participants: { connect: participantIds.map((id) => ({ id })) } },
    });

    return this.getRoom(roomId, userId);
  }

  async removeParticipant(roomId: string, userId: string, participantId: string) {
    const room = await this.getRoom(roomId, userId);
    if (room.type === 'DIRECT') throw new BadRequestException('Cannot remove participants from direct chat');

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { participants: { disconnect: { id: participantId } } },
    });

    return this.getRoom(roomId, userId);
  }

  async startSupportChat(userId: string) {
    const existingRoom = await this.prisma.chatRoom.findFirst({
      where: {
        type: 'SUPPORT',
        participants: { some: { id: userId } },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: MESSAGE_SELECT },
      },
    });

    if (existingRoom) {
      return { ...existingRoom, lastMessage: existingRoom.messages[0] || null };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });

    const participantIds = [userId, ...admins.map((a) => a.id)];

    const room = await this.prisma.chatRoom.create({
      data: {
        name: `Support - ${user.firstName} ${user.lastName}`,
        type: 'SUPPORT',
        participants: { connect: participantIds.map((id) => ({ id })) },
        lastMessageAt: new Date(),
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
      },
    });

    await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: userId,
        content: 'Support chat started. An admin will respond shortly.',
        type: MessageType.SYSTEM,
        readBy: [userId],
      },
    });

    try {
      await this.realtimeService.sendToRole('ADMIN', 'support:new', {
        roomId: room.id,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } catch { /* non-critical */ }

    return { ...room, lastMessage: null };
  }

  async getSupportRooms() {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { type: 'SUPPORT' },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: MESSAGE_SELECT,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const roomIds = rooms.map((r) => r.id);
    const unreadCounts = roomIds.length > 0
      ? await this.prisma.message.groupBy({
          by: ['roomId'],
          where: { roomId: { in: roomIds }, NOT: { type: MessageType.SYSTEM } },
          _count: { id: true },
        })
      : [];

    const unreadMap = new Map(unreadCounts.map((u) => [u.roomId, u._count.id]));

    return rooms.map((room) => ({
      ...room,
      lastMessage: room.messages[0] || null,
      messageCount: unreadMap.get(room.id) || 0,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async broadcastMessage(roomId: string, senderId: string, message: any) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { participants: { select: { id: true } } },
    });

    if (room) {
      await Promise.all(
        room.participants
          .filter((p) => p.id !== senderId)
          .map((p) =>
            this.realtimeService.sendToUser(p.id, 'chat:message', { roomId, message }),
          ),
      );
    }
  }
}
