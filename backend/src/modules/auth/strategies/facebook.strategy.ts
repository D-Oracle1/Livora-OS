/**
 * Facebook OAuth Strategy.
 *
 * Requires:  npm install passport-facebook @types/passport-facebook
 * Env vars:  FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, BACKEND_URL
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy implements OnModuleInit {
  private readonly logger = new Logger(FacebookStrategy.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const clientID = this.config.get<string>('FACEBOOK_APP_ID');
    const clientSecret = this.config.get<string>('FACEBOOK_APP_SECRET');

    if (!clientID || !clientSecret) {
      this.logger.log('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not configured — Facebook OAuth disabled');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Strategy } = require('passport-facebook') as any;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const passport = require('passport') as any;

      const backendUrl = this.config.get<string>('BACKEND_URL', 'http://localhost:4000');
      const callbackURL = `${backendUrl}/api/v1/auth/facebook/callback`;

      passport.default.use(
        'facebook',
        new Strategy(
          {
            clientID,
            clientSecret,
            callbackURL,
            profileFields: ['id', 'emails', 'name', 'picture'],
            scope: ['email'],
          },
          (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
            const email = profile.emails?.[0]?.value;
            const oauthUser = {
              email,
              firstName: profile.name?.givenName ?? '',
              lastName: profile.name?.familyName ?? '',
              avatar: profile.photos?.[0]?.value ?? null,
              facebookId: profile.id,
              provider: 'facebook',
            };
            done(null, oauthUser);
          },
        ),
      );

      this.logger.log('Facebook OAuth strategy registered');
    } catch (err: any) {
      this.logger.warn(`passport-facebook not installed (${err.message}). Run: npm install passport-facebook @types/passport-facebook`);
    }
  }
}
