import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!process.env.CRON_SECRET) {
      throw new UnauthorizedException('CRON_SECRET not configured');
    }

    // Accept x-cron-secret header (manual triggers) or
    // Authorization: Bearer <CRON_SECRET> (Vercel scheduled crons)
    const headerSecret = request.headers['x-cron-secret'];
    const bearerSecret = (request.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
    const secret = headerSecret || bearerSecret;

    if (secret !== process.env.CRON_SECRET) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }
}
