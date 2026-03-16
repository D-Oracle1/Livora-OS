/**
 * Google OAuth 2.0 Strategy.
 *
 * Requires:  npm install passport-google-oauth20 @types/passport-google-oauth20
 * Env vars:  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL
 *
 * Flow:
 *   1.  GET  /api/v1/auth/google        → redirect to Google consent screen
 *   2.  GET  /api/v1/auth/google/callback → receive code → issue JWT
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy implements OnModuleInit {
  private readonly logger = new Logger(GoogleStrategy.name);
  private strategy: any = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const clientID = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientID || !clientSecret) {
      this.logger.log('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured — Google OAuth disabled');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Strategy } = require('passport-google-oauth20') as any;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const passport = require('passport') as any;

      const backendUrl = this.config.get<string>('BACKEND_URL', 'http://localhost:4000');
      const callbackURL = `${backendUrl}/api/v1/auth/google/callback`;

      passport.default.use(
        'google',
        new Strategy(
          { clientID, clientSecret, callbackURL, scope: ['profile', 'email'] },
          (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
            const email = profile.emails?.[0]?.value;
            const oauthUser = {
              email,
              firstName: profile.name?.givenName ?? profile.displayName?.split(' ')[0] ?? '',
              lastName: profile.name?.familyName ?? profile.displayName?.split(' ').slice(1).join(' ') ?? '',
              avatar: profile.photos?.[0]?.value ?? null,
              googleId: profile.id,
              provider: 'google',
            };
            done(null, oauthUser);
          },
        ),
      );

      this.logger.log('Google OAuth strategy registered');
    } catch (err: any) {
      this.logger.warn(`passport-google-oauth20 not installed (${err.message}). Run: npm install passport-google-oauth20 @types/passport-google-oauth20`);
    }
  }

  isConfigured(): boolean {
    return this.strategy !== null;
  }
}
