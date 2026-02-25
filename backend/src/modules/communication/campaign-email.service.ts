import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/services/mail.service';
import { ConfigService } from '@nestjs/config';
import { CampaignLogStatus } from './enums';

@Injectable()
export class CampaignEmailService {
  private readonly logger = new Logger(CampaignEmailService.name);
  private readonly apiUrl: string;
  private readonly maxEmailsPerWeek: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = (this.configService.get<string>('API_URL') || 'http://localhost:4000').trim();
    this.maxEmailsPerWeek = this.configService.get<number>('CAMPAIGN_MAX_EMAILS_PER_WEEK', 5);
  }

  /**
   * Send a campaign email to a specific subscriber.
   * Handles: frequency cap check, idempotency, tracking pixel/click injection, unsubscribe link, log updates.
   */
  async sendToSubscriber(campaignId: string, subscriberId: string): Promise<boolean> {
    const idempotencyKey = `${campaignId}:${subscriberId}`;

    // Idempotency check — skip if already sent
    const existingLog = await this.prisma.campaignLog.findUnique({
      where: { idempotencyKey },
    });
    if (existingLog && existingLog.status !== CampaignLogStatus.PENDING) {
      this.logger.debug(`Skipping duplicate send: ${idempotencyKey}`);
      return false;
    }

    // Load campaign and subscriber
    const [campaign, subscriber] = await Promise.all([
      this.prisma.campaign.findUnique({ where: { id: campaignId } }),
      this.prisma.emailSubscriber.findUnique({ where: { id: subscriberId } }),
    ]);

    if (!campaign || !subscriber) {
      this.logger.warn(`Campaign or subscriber not found: ${campaignId}, ${subscriberId}`);
      return false;
    }

    if (!subscriber.isSubscribed) {
      this.logger.debug(`Subscriber ${subscriber.email} is unsubscribed, skipping`);
      return false;
    }

    // Frequency cap check
    if (!(await this.checkFrequencyCap(subscriber.id))) {
      this.logger.debug(`Frequency cap reached for ${subscriber.email}`);
      await this.updateLog(idempotencyKey, campaignId, subscriberId, subscriber.email, CampaignLogStatus.FAILED, 'Frequency cap reached');
      return false;
    }

    if (!campaign.htmlContent || !campaign.subject) {
      this.logger.warn(`Campaign ${campaignId} has no content or subject`);
      await this.updateLog(idempotencyKey, campaignId, subscriberId, subscriber.email, CampaignLogStatus.FAILED, 'Missing content or subject');
      return false;
    }

    // Create or update log entry as PENDING
    await this.updateLog(idempotencyKey, campaignId, subscriberId, subscriber.email, CampaignLogStatus.PENDING);

    try {
      // Inject tracking pixel & unsubscribe link
      const logEntry = await this.prisma.campaignLog.findUnique({ where: { idempotencyKey } });
      const trackingHtml = this.injectTracking(campaign.htmlContent, logEntry?.id || '', subscriber.unsubscribeToken);

      // Resolve tenant branding for From name / subject prefix
      let tenantBranding: { companyName?: string; logoUrl?: string; primaryColor?: string } = {};
      try {
        const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'cms_branding' } });
        if (setting?.value && typeof setting.value === 'object') {
          const v = setting.value as any;
          tenantBranding = { companyName: v.companyName, logoUrl: v.logo, primaryColor: v.primaryColor };
        }
      } catch { /* non-tenant context — leave branding empty */ }

      // Send via mail service
      const unsubscribeUrl = `${this.apiUrl}/api/v1/communication/unsubscribe/${subscriber.unsubscribeToken}`;
      await this.mailService.sendNewsletterEmail(
        subscriber.email,
        campaign.subject,
        trackingHtml,
        unsubscribeUrl,
        { branding: tenantBranding },
      );

      // Update log to SENT
      await this.prisma.campaignLog.update({
        where: { idempotencyKey },
        data: { status: CampaignLogStatus.SENT, sentAt: new Date() },
      });

      // Update subscriber frequency tracking
      await this.prisma.emailSubscriber.update({
        where: { id: subscriber.id },
        data: {
          lastEmailAt: new Date(),
          emailCount7d: { increment: 1 },
        },
      });

      this.logger.log(`Campaign email sent: ${campaign.subject} → ${subscriber.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send campaign email to ${subscriber.email}: ${error.message}`);
      await this.prisma.campaignLog.update({
        where: { idempotencyKey },
        data: { status: CampaignLogStatus.FAILED, errorMessage: error.message },
      });
      return false;
    }
  }

  /**
   * Send a campaign to all matching subscribers based on audience type.
   */
  async sendCampaignToAudience(campaignId: string): Promise<{ sent: number; failed: number; skipped: number }> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const where: any = { isSubscribed: true };
    if (campaign.tenantId) where.tenantId = campaign.tenantId;

    // Filter by audience type
    if (campaign.audienceType !== 'ALL') {
      where.role = campaign.audienceType; // AudienceType maps to SubscriberRole
    }

    const subscribers = await this.prisma.emailSubscriber.findMany({
      where,
      select: { id: true },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const subscriber of subscribers) {
      const result = await this.sendToSubscriber(campaignId, subscriber.id);
      if (result) {
        sent++;
      } else {
        // Check if it was skipped (idempotency/unsubscribed) vs failed
        const log = await this.prisma.campaignLog.findUnique({
          where: { idempotencyKey: `${campaignId}:${subscriber.id}` },
        });
        if (log?.status === CampaignLogStatus.FAILED) {
          failed++;
        } else {
          skipped++;
        }
      }
    }

    // Update campaign status to COMPLETED if all done
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    this.logger.log(`Campaign ${campaign.title}: sent=${sent}, failed=${failed}, skipped=${skipped}`);
    return { sent, failed, skipped };
  }

  /**
   * Record an email open event (tracking pixel hit).
   */
  async recordOpen(logId: string): Promise<void> {
    try {
      await this.prisma.campaignLog.update({
        where: { id: logId },
        data: { status: CampaignLogStatus.OPENED, openedAt: new Date() },
      });
    } catch {
      this.logger.debug(`Could not record open for log ${logId}`);
    }
  }

  /**
   * Record a click event (link redirect).
   */
  async recordClick(logId: string): Promise<string | null> {
    try {
      const log = await this.prisma.campaignLog.update({
        where: { id: logId },
        data: { status: CampaignLogStatus.CLICKED, clickedAt: new Date() },
      });
      return log ? 'recorded' : null;
    } catch {
      this.logger.debug(`Could not record click for log ${logId}`);
      return null;
    }
  }

  /**
   * Handle unsubscribe by token.
   */
  async unsubscribe(token: string): Promise<{ message: string }> {
    const subscriber = await this.prisma.emailSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      return { message: 'Invalid unsubscribe link.' };
    }

    if (!subscriber.isSubscribed) {
      return { message: 'You are already unsubscribed.' };
    }

    await this.prisma.emailSubscriber.update({
      where: { id: subscriber.id },
      data: { isSubscribed: false },
    });

    return { message: 'You have been successfully unsubscribed.' };
  }

  /**
   * Check if subscriber is within the weekly frequency cap.
   */
  private async checkFrequencyCap(subscriberId: string): Promise<boolean> {
    const subscriber = await this.prisma.emailSubscriber.findUnique({
      where: { id: subscriberId },
      select: { emailCount7d: true, lastEmailAt: true },
    });

    if (!subscriber) return false;

    // Reset counter if last email was more than 7 days ago
    if (subscriber.lastEmailAt) {
      const daysSinceLastEmail = (Date.now() - subscriber.lastEmailAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastEmail >= 7) {
        await this.prisma.emailSubscriber.update({
          where: { id: subscriberId },
          data: { emailCount7d: 0 },
        });
        return true;
      }
    }

    return subscriber.emailCount7d < this.maxEmailsPerWeek;
  }

  /**
   * Inject tracking pixel and modify links for click tracking.
   */
  private injectTracking(html: string, logId: string, unsubscribeToken: string): string {
    // Inject tracking pixel before closing </body> or at the end
    const trackingPixel = `<img src="${this.apiUrl}/api/v1/communication/track/open/${logId}" width="1" height="1" style="display:none" alt="" />`;
    const unsubscribeLink = `\n<p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">
      <a href="${this.apiUrl}/api/v1/communication/unsubscribe/${unsubscribeToken}" style="color: #999;">Unsubscribe</a>
    </p>`;

    let result = html;

    // Add tracking pixel
    if (result.includes('</body>')) {
      result = result.replace('</body>', `${trackingPixel}</body>`);
    } else {
      result = result + trackingPixel;
    }

    // Add unsubscribe link if not already present
    if (!result.toLowerCase().includes('unsubscribe')) {
      result = result + unsubscribeLink;
    }

    return result;
  }

  /**
   * Create or update a campaign log entry.
   */
  private async updateLog(
    idempotencyKey: string,
    campaignId: string,
    subscriberId: string,
    email: string,
    status: CampaignLogStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.campaignLog.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        campaignId,
        subscriberId,
        email,
        status,
        errorMessage,
      },
      update: { status, errorMessage },
    });
  }
}
