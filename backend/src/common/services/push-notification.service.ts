import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webPush = require('web-push');

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    const subject = this.configService.get<string>('webPush.subject');
    const publicKey = this.configService.get<string>('webPush.publicKey')?.trim();
    const privateKey = this.configService.get<string>('webPush.privateKey')?.trim();

    if (publicKey && privateKey) {
      try {
        webPush.setVapidDetails(subject || 'mailto:admin@livora-os.com', publicKey, privateKey);
        this.initialized = true;
        this.logger.log('Web Push notification service initialized');
      } catch (error: any) {
        this.logger.warn(`VAPID setup failed: ${error.message}. Push notifications disabled.`);
      }
    } else {
      this.logger.warn('VAPID keys not configured, push notifications disabled');
    }
  }

  async sendToDevice(subscriptionJson: string, notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const subscription = JSON.parse(subscriptionJson);
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: notification.data,
      });

      await webPush.sendNotification(subscription, payload);
      return true;
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        this.logger.warn('Push subscription expired or invalid, should be removed');
      } else {
        this.logger.error(`Push notification failed: ${error.message}`);
      }
      return false;
    }
  }

  async sendToTokens(tokens: string[], notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.initialized || tokens.length === 0) return;

    await Promise.allSettled(
      tokens.map((token) => this.sendToDevice(token, notification)),
    );
  }
}
