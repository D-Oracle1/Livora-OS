import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { MasterPrismaService } from '../../../database/master-prisma.service';
import { TenantPrismaService } from '../../../database/tenant-prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyId?: string;
  isSuperAdmin?: boolean;
  iat?: number;
  exp?: number;
}

// Cached singleton for fallback DB queries (prevents connection leaks in serverless)
let cachedFallbackClient: PrismaClient | null = null;

function getFallbackClient(): PrismaClient {
  if (!cachedFallbackClient) {
    cachedFallbackClient = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
      log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
    });
  }
  return cachedFallbackClient;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly masterPrisma: MasterPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // SUPER_ADMIN: validate against master DB
    if (payload.isSuperAdmin) {
      return this.validateSuperAdmin(payload);
    }

    // Tenant user: validate against tenant DB
    return this.validateTenantUser(payload);
  }

  private async validateSuperAdmin(payload: JwtPayload) {
    try {
      const admin = await this.masterPrisma.superAdmin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin) {
        throw new UnauthorizedException('Super admin not found');
      }

      return {
        id: admin.id,
        email: admin.email,
        role: 'SUPER_ADMIN',
        firstName: admin.firstName,
        lastName: admin.lastName,
        isSuperAdmin: true,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Failed to validate super admin');
    }
  }

  private async validateTenantUser(payload: JwtPayload) {
    try {
      let user: any;

      if (payload.companyId) {
        // Use tenant-specific client
        const client = await this.tenantPrisma.getClient(payload.companyId);
        user = await client.user.findUnique({
          where: { id: payload.sub },
        });
      } else {
        // Fallback: use cached default DB client
        // This handles legacy tokens or users without companyId
        const fallback = getFallbackClient();
        user = await fallback.user.findUnique({
          where: { id: payload.sub },
        });
      }

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: payload.companyId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if ((error as any)?.message?.includes('inactive')) {
        throw new UnauthorizedException('Company account has been suspended');
      }
      throw new UnauthorizedException('Failed to validate user');
    }
  }
}
