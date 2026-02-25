import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { MailService } from './mail.service';

export type EmailJobType =
  | 'welcome'
  | 'verification'
  | 'sale_confirmation_realtor'
  | 'sale_confirmation_client'
  | 'commission_paid'
  | 'payment_reminder'
  | 'leave_approved'
  | 'leave_rejected'
  | 'task_assigned'
  | 'performance_review'
  | 'newsletter';

export interface EmailJob {
  type: EmailJobType;
  to: string;
  data: any;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private emailQueue: Queue | null = null;
  private emailWorker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    // Skip BullMQ in serverless — Workers require persistent connections
    if (process.env.VERCEL) {
      this.logger.log('Vercel environment detected, emails will be sent synchronously');
      return;
    }

    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password') || undefined,
    };

    try {
      this.emailQueue = new Queue('emails', { connection });

      this.emailWorker = new Worker(
        'emails',
        async (job: Job<EmailJob>) => {
          await this.processEmailJob(job.data);
        },
        {
          connection,
          concurrency: 5,
        },
      );

      this.emailWorker.on('completed', (job) => {
        this.logger.log(`Email job ${job.id} completed`);
      });

      this.emailWorker.on('failed', (job, err) => {
        this.logger.error(`Email job ${job?.id} failed: ${err.message}`);
      });

      this.logger.log('Email queue initialized');
    } catch (error) {
      this.logger.warn(`Queue init failed: ${error.message}. Running emails synchronously.`);
    }
  }

  onModuleDestroy() {
    this.emailWorker?.close();
    this.emailQueue?.close();
  }

  async addEmailJob(data: EmailJob): Promise<void> {
    if (this.emailQueue) {
      await this.emailQueue.add('send-email', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
    } else {
      // Fallback: send synchronously
      await this.processEmailJob(data);
    }
  }

  async getQueueStats() {
    if (!this.emailQueue) return null;

    return {
      waiting: await this.emailQueue.getWaitingCount(),
      active: await this.emailQueue.getActiveCount(),
      completed: await this.emailQueue.getCompletedCount(),
      failed: await this.emailQueue.getFailedCount(),
    };
  }

  private async processEmailJob(data: EmailJob): Promise<void> {
    const { type, to, data: payload } = data;

    const companyName: string | undefined = payload?.companyName;
    switch (type) {
      case 'welcome':
        await this.mailService.sendWelcomeEmail(to, payload, companyName);
        break;
      case 'verification':
        await this.mailService.sendEmailVerificationEmail(to, payload.verificationUrl);
        break;
      case 'sale_confirmation_realtor':
        await this.mailService.sendSaleConfirmationToRealtor(to, payload, companyName);
        break;
      case 'sale_confirmation_client':
        await this.mailService.sendSaleConfirmationToClient(to, payload, companyName);
        break;
      case 'commission_paid':
        await this.mailService.sendCommissionPaidEmail(to, payload, companyName);
        break;
      case 'payment_reminder':
        await this.mailService.sendPaymentReminderEmail(to, payload, companyName);
        break;
      case 'leave_approved':
        await this.mailService.sendLeaveApprovedEmail(to, payload, companyName);
        break;
      case 'leave_rejected':
        await this.mailService.sendLeaveRejectedEmail(to, payload, companyName);
        break;
      case 'task_assigned':
        await this.mailService.sendTaskAssignedEmail(to, payload, companyName);
        break;
      case 'performance_review':
        await this.mailService.sendPerformanceReviewEmail(to, payload, companyName);
        break;
      case 'newsletter':
        await this.mailService.sendNewsletterEmail(to, payload.subject, payload.content, payload.unsubscribeUrl, {
          branding: payload.branding,
          attachments: payload.attachments,
        });
        break;
      default:
        this.logger.warn(`Unknown email job type: ${type}`);
    }
  }
}
