import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CrmActivityData {
  agentId: string;
  clientId: string;
  activityType: 'chat' | 'voice_note' | 'follow_up' | 'deal_update' | 'call';
  referenceId?: string;
  notes?: string;
}

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Activity Logging ───────────────────────────────────────────────────────

  async logActivity(data: CrmActivityData): Promise<void> {
    try {
      await this.prisma.crmActivity.create({
        data: {
          agentId: data.agentId,
          clientId: data.clientId,
          activityType: data.activityType,
          referenceId: data.referenceId,
          notes: data.notes,
        },
      });
    } catch (err) {
      // Non-critical — never fail the parent operation
      this.logger.error(`CRM log failed: ${err.message}`);
    }
  }

  // ── Engagement Scoring ────────────────────────────────────────────────────

  /**
   * Called after each chat/voice interaction with a client.
   * Updates lastContactedAt, lastMessageSnippet, and recalculates engagementScore.
   * Engagement score = messages in last 30 days (capped at 100).
   */
  async updateEngagement(clientUserId: string, snippet: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Count recent activities
      const recentCount = await this.prisma.crmActivity.count({
        where: {
          clientId: clientUserId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const score = Math.min(100, recentCount * 5); // 5 pts per interaction, cap 100

      await this.prisma.clientProfile.updateMany({
        where: { userId: clientUserId },
        data: {
          lastContactedAt: new Date(),
          lastMessageSnippet: snippet.slice(0, 120),
          engagementScore: score,
        },
      });
    } catch (err) {
      this.logger.error(`Engagement update failed: ${err.message}`);
    }
  }

  // ── Lead Intelligence ─────────────────────────────────────────────────────

  /** Hot leads: engagement score >= 30, contacted in last 7 days */
  async getHotLeads(limit = 20) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const profiles = await this.prisma.clientProfile.findMany({
      where: {
        engagementScore: { gte: 30 },
        lastContactedAt: { gte: sevenDaysAgo },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        realtor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { engagementScore: 'desc' },
      take: limit,
    });

    return profiles.map(this.formatLeadProfile);
  }

  /** Cold leads: no contact in 14+ days OR score < 10 */
  async getColdLeads(limit = 20) {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const profiles = await this.prisma.clientProfile.findMany({
      where: {
        OR: [
          { lastContactedAt: { lt: fourteenDaysAgo } },
          { lastContactedAt: null },
          { engagementScore: { lt: 10 } },
        ],
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        realtor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { lastContactedAt: 'asc' },
      take: limit,
    });

    return profiles.map(this.formatLeadProfile);
  }

  /** Pending follow-ups: no contact in 3–13 days (warm window) */
  async getPendingFollowUps(limit = 20) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);

    const profiles = await this.prisma.clientProfile.findMany({
      where: {
        lastContactedAt: {
          gte: thirteenDaysAgo,
          lt: threeDaysAgo,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        realtor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { lastContactedAt: 'asc' },
      take: limit,
    });

    return profiles.map(this.formatLeadProfile);
  }

  /** Full CRM profile for a single client */
  async getClientProfile(clientUserId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientUserId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true, phone: true },
        },
        realtor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!profile) return null;

    // Recent activities
    const recentActivities = await this.prisma.crmActivity.findMany({
      where: { clientId: clientUserId },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      ...this.formatLeadProfile(profile),
      recentActivities,
    };
  }

  /** Recent activity feed for a client (admin/agent view) */
  async getActivities(clientUserId: string, limit = 20) {
    return this.prisma.crmActivity.findMany({
      where: { clientId: clientUserId },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formatLeadProfile(profile: any) {
    const daysSinceContact = profile.lastContactedAt
      ? Math.floor((Date.now() - new Date(profile.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: profile.id,
      userId: profile.userId,
      user: profile.user,
      realtorId: profile.realtorId,
      realtor: profile.realtor
        ? { id: profile.realtor.id, user: profile.realtor.user }
        : null,
      engagementScore: profile.engagementScore,
      lastContactedAt: profile.lastContactedAt,
      lastMessageSnippet: profile.lastMessageSnippet,
      daysSinceContact,
      totalPurchaseValue: profile.totalPurchaseValue,
    };
  }

  /**
   * Determine if the OTHER participant in a chat is a CLIENT and return their userId.
   * Returns null if no client is involved (e.g. staff-to-staff chat).
   */
  async resolveClientInRoom(roomId: string, senderId: string): Promise<string | null> {
    try {
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: { select: { id: true, role: true } },
        },
      });
      if (!room) return null;

      // Find a participant who is a CLIENT and is NOT the sender
      const client = room.participants.find(
        (p) => p.role === 'CLIENT' && p.id !== senderId,
      );
      return client?.id ?? null;
    } catch {
      return null;
    }
  }
}
