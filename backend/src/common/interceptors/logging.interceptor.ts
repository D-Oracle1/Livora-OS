import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Structured HTTP request/response logging interceptor.
 *
 * Emits JSON-compatible log lines so they can be parsed by log aggregators
 * (Datadog, Logtail, CloudWatch). Sensitive routes (auth) redact the body.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly SENSITIVE_PATHS = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/change-password'];
  private readonly SKIP_PATHS = ['/health'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, user } = request;

    // Skip logging for lightweight keepalive / health endpoints
    if (this.SKIP_PATHS.some((p) => url.includes(p))) {
      return next.handle() as any;
    }

    const now = Date.now();
    const userId = user?.id || 'anonymous';
    const isSensitive = this.SENSITIVE_PATHS.some((p) => url.includes(p));

    this.logger.log(
      JSON.stringify({
        event: 'request',
        method,
        url,
        userId,
        ip,
        body: isSensitive ? '[REDACTED]' : undefined,
        ts: new Date().toISOString(),
      }),
    );

    return (next.handle() as any).pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const durationMs = Date.now() - now;

          this.logger.log(
            JSON.stringify({
              event: 'response',
              method,
              url,
              userId,
              statusCode,
              durationMs,
              ts: new Date().toISOString(),
            }),
          );
        },
        error: (error: Error) => {
          const durationMs = Date.now() - now;
          this.logger.error(
            JSON.stringify({
              event: 'error',
              method,
              url,
              userId,
              error: error.message,
              durationMs,
              ts: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}
