/**
 * Sentry error-tracking integration.
 *
 * Loads @sentry/node dynamically so the app starts normally even if the package
 * is not installed.  Install it with:
 *   npm install @sentry/node --save
 * then set SENTRY_DSN in your .env.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly logger = new Logger(SentryService.name);
  private sentry: any = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    if (!dsn) {
      this.logger.log('Sentry DSN not configured — error tracking disabled');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sentry = require('@sentry/node') as any;
      Sentry.init({
        dsn,
        environment: this.configService.get<string>('NODE_ENV', 'development'),
        tracesSampleRate: this.configService.get<number>('SENTRY_TRACES_SAMPLE_RATE', 0.1),
        release: process.env.npm_package_version,
        integrations: [],
      });
      this.sentry = Sentry as any;
      this.enabled = true;
      this.logger.log('Sentry error tracking initialized');
    } catch (err: any) {
      this.logger.warn(`Sentry not available (${err.message}) — install @sentry/node to enable`);
    }
  }

  captureException(err: Error, context?: Record<string, any>): void {
    if (!this.enabled || !this.sentry) return;
    this.sentry.withScope((scope: any) => {
      if (context) scope.setExtras(context);
      this.sentry.captureException(err);
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.enabled || !this.sentry) return;
    this.sentry.captureMessage(message, level);
  }

  setUser(user: { id: string; email?: string; role?: string } | null): void {
    if (!this.enabled || !this.sentry) return;
    this.sentry.configureScope((scope: any) => scope.setUser(user));
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
