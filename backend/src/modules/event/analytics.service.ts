import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EventAnalyticsService {
  private readonly logger = new Logger(EventAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ensure an analytics row exists for the event, then return it. */
  private async ensureRow(eventId: string) {
    return this.prisma.eventAnalytics.upsert({
      where: { eventId },
      create: { eventId },
      update: {},
    });
  }

  async incrementViews(eventId: string): Promise<void> {
    try {
      await this.ensureRow(eventId);
      await this.prisma.eventAnalytics.update({
        where: { eventId },
        data: {
          viewsCount: { increment: 1 },
          lastUpdated: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to increment views for event ${eventId}: ${err.message}`);
    }
  }

  async recomputeRegistrations(eventId: string): Promise<void> {
    try {
      const [registrationsCount, checkinsCount] = await Promise.all([
        this.prisma.eventRegistration.count({ where: { eventId } }),
        this.prisma.eventRegistration.count({ where: { eventId, checkedIn: true } }),
      ]);

      const analytics = await this.ensureRow(eventId);
      const viewsCount = analytics.viewsCount || 1;
      const conversionRate =
        viewsCount > 0
          ? Math.min(((registrationsCount / viewsCount) * 100), 100)
          : 0;

      await this.prisma.eventAnalytics.update({
        where: { eventId },
        data: {
          registrationsCount,
          checkinsCount,
          conversionRate,
          lastUpdated: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to recompute analytics for event ${eventId}: ${err.message}`);
    }
  }

  async getAnalytics(eventId: string) {
    const row = await this.prisma.eventAnalytics.findUnique({ where: { eventId } });
    if (!row) return { viewsCount: 0, registrationsCount: 0, checkinsCount: 0, conversionRate: 0 };
    return row;
  }
}
