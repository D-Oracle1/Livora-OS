/**
 * Structured logger service.
 *
 * Outputs JSON-structured log lines to stdout.  Readable locally (parsed by
 * pino-pretty or similar), and ingestable by Datadog / Logtail / CloudWatch.
 *
 * When LOGTAIL_TOKEN is set, logs are also shipped to Logtail (Better Stack)
 * via their structured-logging endpoint (fire-and-forget — never throws).
 *
 * Wraps NestJS Logger so it can be swapped in transparently.
 */
import { Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type StructuredLog = {
  level: string;
  message: string;
  context?: string;
  timestamp: string;
  pid: number;
  env: string;
  [key: string]: any;
};

@Injectable()
export class StructuredLoggerService {
  private readonly env: string;
  private readonly logtailToken: string | undefined;
  private readonly logtailUrl = 'https://in.logs.betterstack.com';
  private readonly logBuffer: StructuredLog[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: ConfigService) {
    this.env = config.get('NODE_ENV', 'development');
    this.logtailToken = config.get<string>('LOGTAIL_TOKEN');
  }

  log(message: string, context?: string, extra?: Record<string, any>) {
    this.write('info', message, context, extra);
  }

  warn(message: string, context?: string, extra?: Record<string, any>) {
    this.write('warn', message, context, extra);
  }

  error(message: string, context?: string, extra?: Record<string, any>) {
    this.write('error', message, context, extra);
  }

  debug(message: string, context?: string, extra?: Record<string, any>) {
    if (this.env === 'production') return; // suppress debug in prod
    this.write('debug', message, context, extra);
  }

  logRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    durationMs: number;
    userId?: string;
    ip?: string;
  }) {
    this.write('info', `${data.method} ${data.url} ${data.statusCode} ${data.durationMs}ms`, 'HTTP', data);
  }

  private write(level: string, message: string, context?: string, extra?: Record<string, any>) {
    const entry: StructuredLog = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      env: this.env,
      ...extra,
    };

    // Always write to stdout
    process.stdout.write(JSON.stringify(entry) + '\n');

    // Buffer for Logtail shipping
    if (this.logtailToken) {
      this.logBuffer.push(entry);
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 2000);
  }

  private async flush() {
    if (!this.logtailToken || this.logBuffer.length === 0) return;
    const batch = this.logBuffer.splice(0, this.logBuffer.length);
    try {
      await fetch(this.logtailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.logtailToken}`,
        },
        body: JSON.stringify(batch),
      });
    } catch {
      // Non-critical: put logs back
      this.logBuffer.unshift(...batch);
    }
  }
}
