import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

export interface OAuthProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  provider: 'google' | 'facebook';
  googleId?: string;
  facebookId?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Find or create a user from an OAuth profile, then issue JWT tokens.
   * The user is created with a random unguessable password (OAuth-only access).
   * Email is considered pre-verified for OAuth users.
   */
  async findOrCreateUser(profile: OAuthProfile, companyId?: string | null) {
    if (!profile.email) {
      throw new Error('OAuth profile does not contain an email address');
    }

    const email = profile.email.toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create new user (auto-verified via OAuth)
      const randomPassword = await bcrypt.hash(uuidv4(), 12);
      user = await this.prisma.user.create({
        data: {
          email,
          password: randomPassword,
          firstName: profile.firstName || email.split('@')[0],
          lastName: profile.lastName || '',
          avatar: profile.avatar ?? null,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          referralCode: `REF-${uuidv4().substring(0, 8).toUpperCase()}`,
        },
      });

      // Create client profile
      await this.prisma.clientProfile.create({ data: { userId: user.id } });

      this.logger.log(`OAuth: created new ${profile.provider} user: ${email}`);
    } else {
      // Update avatar if newer
      if (profile.avatar && !user.avatar) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { avatar: profile.avatar, lastLoginAt: new Date() },
        });
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {});
      }
    }

    const tokens = await this.authService.generateTokens(user, companyId);
    const { password, ...safeUser } = user;

    return {
      user: { ...safeUser, companyId },
      ...tokens,
      isNewUser: !user.createdAt || (Date.now() - new Date(user.createdAt).getTime() < 5000),
    };
  }
}
