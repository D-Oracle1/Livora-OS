import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessageType, UserRole } from '@prisma/client';
import { RealtimeService } from '../../common/services/realtime.service';

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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createRoom(creatorId: string, participantIds: string[], name?: string) {
    // Include creator in participants
    const allParticipants = [...new Set([creatorId, ...participantIds])];

    if (allParticipants.length < 2) {
      throw new BadRequestException('At least 2 participants required');
    }

    // Check if direct chat already exists between exactly these 2 users
    if (allParticipants.length === 2) {
      const existingRoom = await this.prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          // Both users must be participants AND no third participant exists
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
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            },
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
        participants: {
          some: { id: userId },
        },
        type: { not: 'SUPPORT' },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (rooms.length === 0) return [];

    // Batch unread counts in a single query instead of N+1
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
        participants: {
          some: { id: userId },
        },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    return room;
  }

  async getMessages(roomId: string, userId: string, query: {
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    // Verify user is participant and fetch messages in parallel
    const participantFilter = { room: { participants: { some: { id: userId } } } };

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { roomId, ...participantFilter },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      }),
      this.prisma.message.count({ where: { roomId, ...participantFilter } }),
    ]);

    if (messages.length === 0 && total === 0 && page === 1) {
      // Check if room exists at all — could be no messages yet or unauthorized
      const room = await this.prisma.chatRoom.findFirst({
        where: { id: roomId, participants: { some: { id: userId } } },
        select: { id: true },
      });
      if (!room) throw new NotFoundException('Chat room not found');
    }

    return {
      data: messages.reverse(),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    data: {
      content: string;
      type?: MessageType;
      attachments?: any[];
    },
  ) {
    // Verify user is participant
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
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // Update room's last message time
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });

    // Get room participants to send real-time update
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          select: { id: true },
        },
      },
    });

    // Send to all participants via realtime broadcast
    if (room) {
      await Promise.all(
        room.participants
          .filter((p) => p.id !== senderId)
          .map((p) =>
            this.realtimeService.sendToUser(p.id, 'chat:message', {
              roomId,
              message,
            }),
          ),
      );
    }

    return message;
  }

  async markAsRead(roomId: string, userId: string) {
    // Verify user is participant
    await this.getRoom(roomId, userId);

    // Mark all unread messages as read
    await this.prisma.message.updateMany({
      where: {
        roomId,
        NOT: {
          readBy: { has: userId },
        },
      },
      data: {
        readBy: {
          push: userId,
        },
      },
    });

    return { success: true };
  }

  private getAllowedRoles(callerRole: string): UserRole[] {
    return DEFAULT_CHAT_ZONES[callerRole] || [UserRole.ADMIN];
  }

  async searchUsers(currentUserId: string, callerRole: string, search: string) {
    if (!search || search.trim().length < 2) {
      return [];
    }

    const allowedRoles = this.getAllowedRoles(callerRole);

    const users = await this.prisma.user.findMany({
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
      },
      take: 20,
    });

    return users;
  }

  async getContacts(currentUserId: string, callerRole: string) {
    const allowedRoles = this.getAllowedRoles(callerRole);

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: 'ACTIVE',
        role: { in: allowedRoles },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: 100,
    });

    // Group by role
    const grouped: Record<string, typeof users> = {};
    for (const user of users) {
      const role = user.role;
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(user);
    }

    return { contacts: users, grouped };
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.getRoom(roomId, userId);

    // Only allow deletion if user is participant
    await this.prisma.chatRoom.delete({
      where: { id: roomId },
    });

    return { message: 'Chat room deleted' };
  }

  async addParticipants(roomId: string, userId: string, participantIds: string[]) {
    const room = await this.getRoom(roomId, userId);

    if (room.type === 'DIRECT') {
      throw new BadRequestException('Cannot add participants to direct chat');
    }

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        participants: {
          connect: participantIds.map((id) => ({ id })),
        },
      },
    });

    return this.getRoom(roomId, userId);
  }

  async removeParticipant(roomId: string, userId: string, participantId: string) {
    const room = await this.getRoom(roomId, userId);

    if (room.type === 'DIRECT') {
      throw new BadRequestException('Cannot remove participants from direct chat');
    }

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        participants: {
          disconnect: { id: participantId },
        },
      },
    });

    return this.getRoom(roomId, userId);
  }

  async startSupportChat(userId: string) {
    // Check if user already has a support room
    const existingRoom = await this.prisma.chatRoom.findFirst({
      where: {
        type: 'SUPPORT',
        participants: { some: { id: userId } },
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existingRoom) {
      return {
        ...existingRoom,
        lastMessage: existingRoom.messages[0] || null,
      };
    }

    // Get the user's info for room naming
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find all active admin users
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });

    const participantIds = [userId, ...admins.map((a) => a.id)];

    // Create the support room
    const room = await this.prisma.chatRoom.create({
      data: {
        name: `Support - ${user.firstName} ${user.lastName}`,
        type: 'SUPPORT',
        participants: {
          connect: participantIds.map((id) => ({ id })),
        },
        lastMessageAt: new Date(),
      },
      include: {
        participants: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
      },
    });

    // Send a system message
    await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: userId,
        content: 'Support chat started. An admin will respond shortly.',
        type: MessageType.SYSTEM,
        readBy: [userId],
      },
    });

    // Notify admins via realtime
    try {
      await this.realtimeService.sendToRole('ADMIN', 'support:new', {
        roomId: room.id,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } catch (e) {
      // Non-critical, don't fail the request
    }

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
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Get unread counts for all support rooms
    const roomIds = rooms.map((r) => r.id);
    const unreadCounts = roomIds.length > 0
      ? await this.prisma.message.groupBy({
          by: ['roomId'],
          where: {
            roomId: { in: roomIds },
            NOT: { type: MessageType.SYSTEM },
          },
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
}
