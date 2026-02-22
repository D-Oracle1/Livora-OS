import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { CompanyService } from '../company/company.service';
import { MailService } from '../../common/services/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly companyService: CompanyService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Register a new user.
   * If inviteCode is provided, registers in the company's tenant DB.
   * If on a tenant domain (req.tenant.companyId set), registers in that tenant DB.
   * Otherwise registers in the default DB.
   */
  async register(registerDto: RegisterDto, companyId?: string | null) {
    // If invite code provided, resolve company and register in its tenant DB
    if (registerDto.inviteCode) {
      return this.registerWithInviteCode(registerDto);
    }

    // Normalize email to lowercase
    registerDto.email = registerDto.email.toLowerCase();

    // Standard registration in current tenant DB (PrismaService is request-scoped)
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Resolve referrer if referral code provided
    let referrerId: string | null = null;
    if (registerDto.referralCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: registerDto.referralCode },
      });
      if (referrer) referrerId = referrer.id;
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role: registerDto.role || UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        referralCode: `REF-${uuidv4().substring(0, 8).toUpperCase()}`,
        referredBy: referrerId,
      },
    });

    // Create role-specific profile
    await this.createRoleProfile(this.prisma, user, registerDto);

    // Award referral reward to referrer
    if (referrerId) {
      await this.awardReferralReward(this.prisma, referrerId);
    }

    const tokens = await this.generateTokens(user, companyId);

    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  /**
   * Register a user using an invite code.
   * Resolves the company, connects to its tenant DB, and creates the user there.
   * First user with the invite code becomes ADMIN.
   */
  private async registerWithInviteCode(registerDto: RegisterDto) {
    // Normalize email to lowercase
    registerDto.email = registerDto.email.toLowerCase();

    const company = await this.companyService.resolveByInviteCode(
      registerDto.inviteCode!,
    );

    if (!company) {
      throw new BadRequestException('Invalid invite code');
    }

    if (!company.isActive) {
      throw new BadRequestException('This company is currently inactive');
    }

    // Get tenant DB client for this company
    const tenantClient = await this.tenantPrisma.getClient(company.id);

    // Check if email already exists in this tenant
    const existing = await tenantClient.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists in this company');
    }

    // Resolve referrer if referral code provided
    let referrerId: string | null = null;
    if (registerDto.referralCode) {
      const referrer = await tenantClient.user.findUnique({
        where: { referralCode: registerDto.referralCode },
      });
      if (referrer) referrerId = referrer.id;
    }

    // Check if this is the first user (becomes ADMIN)
    const userCount = await tenantClient.user.count();
    const role = userCount === 0 ? UserRole.ADMIN : (registerDto.role || UserRole.CLIENT);

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = await tenantClient.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role,
        status: UserStatus.ACTIVE,
        referralCode: `REF-${uuidv4().substring(0, 8).toUpperCase()}`,
        referredBy: referrerId,
      },
    });

    // Create role-specific profile using tenant client
    await this.createRoleProfile(tenantClient, user, registerDto);

    // Award referral reward to referrer
    if (referrerId) {
      await this.awardReferralReward(tenantClient, referrerId);
    }

    const tokens = await this.generateTokens(user, company.id);

    const { password, ...userWithoutPassword } = user;

    return {
      user: { ...userWithoutPassword, companyId: company.id },
      company: { id: company.id, name: company.name, slug: company.slug, domain: company.domain },
      ...tokens,
    };
  }

  /**
   * Login — dual auth.
   * First checks if it's a SUPER_ADMIN login (master DB).
   * If not, falls back to tenant user login (request-scoped PrismaService).
   */
  async login(loginDto: LoginDto, companyId?: string | null) {
    // Normalize email to lowercase
    loginDto.email = loginDto.email.toLowerCase();

    // Try SUPER_ADMIN login from master DB
    const superAdmin = await this.validateSuperAdmin(
      loginDto.email,
      loginDto.password,
    );

    if (superAdmin) {
      const tokens = await this.generateSuperAdminTokens(superAdmin);
      const { password, ...safeAdmin } = superAdmin;
      return {
        user: {
          ...safeAdmin,
          role: 'SUPER_ADMIN',
          isSuperAdmin: true,
        },
        ...tokens,
      };
    }

    // Tenant user login
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Block login if the tenant company has been deactivated
    if (companyId) {
      const co = await this.masterPrisma.company.findUnique({
        where: { id: companyId },
        select: { isActive: true },
      });
      if (co && !co.isActive) {
        throw new UnauthorizedException(
          'This company account has been suspended. Please contact support.',
        );
      }
    }

    // Generate referral code if user doesn't have one (legacy accounts)
    if (!user.referralCode) {
      const referralCode = `REF-${uuidv4().substring(0, 8).toUpperCase()}`;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), referralCode },
      });
      user.referralCode = referralCode;
    } else {
      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const tokens = await this.generateTokens(user, companyId);

    const { password, ...userWithoutPassword } = user;

    return {
      user: { ...userWithoutPassword, companyId },
      ...tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Validate SUPER_ADMIN against master DB super_admins table.
   */
  private async validateSuperAdmin(email: string, password: string) {
    try {
      const admin = await this.masterPrisma.superAdmin.findUnique({
        where: { email },
      });

      if (!admin) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return null;
      }

      return admin;
    } catch (error) {
      this.logger.debug(`Super admin lookup failed (expected if master DB not set up): ${error}`);
      return null;
    }
  }

  async generateTokens(user: any, companyId?: string | null) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: companyId || undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '30d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn', '7d'),
    };
  }

  /**
   * Generate tokens for SUPER_ADMIN (stored in master DB, no tenant context).
   */
  private async generateSuperAdminTokens(admin: any) {
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: uuidv4(), // SUPER_ADMIN doesn't use refresh token table in tenant DB
      expiresIn: this.configService.get<string>('jwt.expiresIn', '7d'),
    };
  }

  async refreshTokens(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    return this.generateTokens(storedToken.user);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      // Logout from all devices
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Admin-initiated password reset — no current password required.
   * Invalidates all active refresh tokens to force a re-login.
   */
  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new BadRequestException('User not found');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
  }

  async updateProfile(userId: string, updateDto: UpdateUserDto, isSuperAdmin = false) {
    const data: any = {};
    if (updateDto.firstName) data.firstName = updateDto.firstName;
    if (updateDto.lastName) data.lastName = updateDto.lastName;
    if (updateDto.phone !== undefined) data.phone = updateDto.phone;
    if (updateDto.avatar !== undefined) data.avatar = updateDto.avatar;

    if (isSuperAdmin) {
      const updated = await this.masterPrisma.superAdmin.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
        },
      });
      return { ...updated, role: 'SUPER_ADMIN', isSuperAdmin: true };
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        referralCode: true,
      },
    });
  }

  async getMyReferrals(userId: string) {
    const referrals = await this.prisma.user.findMany({
      where: { referredBy: userId, role: { not: 'SUPER_ADMIN' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: referrals, total: referrals.length };
  }

  async getAllReferrals() {
    const referrals = await this.prisma.user.findMany({
      where: { referredBy: { not: null }, role: { not: 'SUPER_ADMIN' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        referredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get referrer details
    const referrerIds = [...new Set(referrals.map((r) => r.referredBy!))];
    const referrers = await this.prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        referralCode: true,
      },
    });

    const referrerMap = new Map(referrers.map((r) => [r.id, r]));

    const data = referrals.map((r) => ({
      ...r,
      referrer: referrerMap.get(r.referredBy!) || null,
    }));

    return { data, total: data.length };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        adminProfile: true,
        realtorProfile: true,
        clientProfile: {
          include: {
            realtor: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get SUPER_ADMIN profile from master DB.
   */
  async getSuperAdminProfile(adminId: string) {
    const admin = await this.masterPrisma.superAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Super admin not found');
    }

    const { password, ...safeAdmin } = admin;
    return { ...safeAdmin, role: 'SUPER_ADMIN', isSuperAdmin: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success to prevent user enumeration
    if (!user) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Delete any existing reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Generate a random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token with 1 hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    // Build reset URL
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}`;

    // Send email (fire-and-forget, don't block the response)
    this.mailService.sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      this.logger.error(`Failed to send password reset email: ${err.message}`);
    });

    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    // Hash the token to match stored value
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Delete the used token
    await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } });

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Create role-specific profile for a user.
   */
  private async createRoleProfile(prismaClient: any, user: any, registerDto: RegisterDto) {
    if (user.role === UserRole.REALTOR) {
      await prismaClient.realtorProfile.create({
        data: {
          userId: user.id,
          licenseNumber: registerDto.licenseNumber || `LIC-${uuidv4().substring(0, 8).toUpperCase()}`,
          agency: registerDto.agency,
          specializations: registerDto.specializations || [],
        },
      });
    } else if (user.role === UserRole.CLIENT) {
      await prismaClient.clientProfile.create({
        data: {
          userId: user.id,
        },
      });
      // Auto-subscribe new clients to newsletter
      try {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined;
        await prismaClient.newsletterSubscriber.upsert({
          where: { email: user.email },
          update: { isActive: true, name: fullName },
          create: { email: user.email, name: fullName },
        });
      } catch {
        // Don't fail registration if newsletter subscribe fails
      }
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.GENERAL_OVERSEER) {
      await prismaClient.adminProfile.create({
        data: {
          userId: user.id,
          permissions: ['all'],
        },
      });
    }
  }

  /**
   * Award referral reward to the referrer.
   * If the referrer is a realtor, award loyalty points.
   */
  private async awardReferralReward(prismaClient: any, referrerId: string) {
    try {
      const referrer = await prismaClient.user.findUnique({
        where: { id: referrerId },
        include: { realtorProfile: true },
      });

      if (referrer?.realtorProfile) {
        const REFERRAL_POINTS = 50;

        await prismaClient.loyaltyPoints.create({
          data: {
            realtorId: referrer.realtorProfile.id,
            points: REFERRAL_POINTS,
            source: 'REFERRAL',
            description: 'Referral bonus - new user signed up with your referral link',
          },
        });

        await prismaClient.realtorProfile.update({
          where: { id: referrer.realtorProfile.id },
          data: {
            loyaltyPoints: { increment: REFERRAL_POINTS },
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to award referral reward: ${error}`);
    }
  }
}
