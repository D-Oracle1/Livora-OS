import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

/**
 * TOTP-based Two-Factor Authentication service.
 *
 * Uses built-in RFC 6238 TOTP — no external library required.
 * Compatible with Google Authenticator, Authy, and any TOTP app.
 *
 * The 2FA columns (twoFactorEnabled, twoFactorSecret, twoFactorRecoveryCodes)
 * are not in schema.prisma (to avoid breaking Prisma queries on DBs that haven't
 * been migrated yet). All reads/writes use raw SQL via $queryRaw / $executeRaw.
 *
 * Migration SQL (run once per tenant DB):
 *   ALTER TABLE "User"
 *     ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
 *     ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT,
 *     ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" JSONB NOT NULL DEFAULT '[]';
 */
@Injectable()
export class TwoFaService {
  private readonly logger = new Logger(TwoFaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Raw SQL helpers
  // ─────────────────────────────────────────────

  private async read2fa(userId: string): Promise<{
    email: string;
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    twoFactorRecoveryCodes: string[];
  } | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT "email", "twoFactorEnabled", "twoFactorSecret", "twoFactorRecoveryCodes"
        FROM "User"
        WHERE "id" = ${userId}
        LIMIT 1
      `;
      if (!rows.length) return null;
      const r = rows[0];
      return {
        email: r.email,
        twoFactorEnabled: Boolean(r.twoFactorEnabled),
        twoFactorSecret: r.twoFactorSecret ?? null,
        twoFactorRecoveryCodes: Array.isArray(r.twoFactorRecoveryCodes)
          ? r.twoFactorRecoveryCodes
          : [],
      };
    } catch (err: any) {
      // Columns don't exist yet — migration pending
      if (err.message?.includes('column') || err.message?.includes('twoFactor')) {
        return null;
      }
      throw err;
    }
  }

  private async write2fa(
    userId: string,
    data: {
      twoFactorEnabled?: boolean;
      twoFactorSecret?: string | null;
      twoFactorRecoveryCodes?: string[];
    },
  ): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.twoFactorEnabled !== undefined) {
      sets.push(`"twoFactorEnabled" = $${sets.length + 1}`);
      values.push(data.twoFactorEnabled);
    }
    if ('twoFactorSecret' in data) {
      sets.push(`"twoFactorSecret" = $${sets.length + 1}`);
      values.push(data.twoFactorSecret ?? null);
    }
    if (data.twoFactorRecoveryCodes !== undefined) {
      sets.push(`"twoFactorRecoveryCodes" = $${sets.length + 1}::jsonb`);
      values.push(JSON.stringify(data.twoFactorRecoveryCodes));
    }

    if (!sets.length) return;

    const sql = `UPDATE "User" SET ${sets.join(', ')} WHERE "id" = $${sets.length + 1}`;
    values.push(userId);

    try {
      await this.prisma.$executeRawUnsafe(sql, ...values);
    } catch (err: any) {
      if (err.message?.includes('column') || err.message?.includes('twoFactor')) {
        throw new BadRequestException(
          '2FA is not available yet — the database migration has not been applied. Contact your system administrator.',
        );
      }
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // Setup / Enroll
  // ─────────────────────────────────────────────

  async generateSetupData(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const user = await this.read2fa(userId);
    if (!user) throw new BadRequestException('User not found or 2FA not available');
    if (user.twoFactorEnabled) throw new BadRequestException('2FA is already enabled');

    const secret = this.generateSecret();
    const backupCodes = this.generateRecoveryCodes();

    await this.write2fa(userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: backupCodes,
    });

    const appName = 'RMS Platform';
    const qrCodeUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}&algorithm=SHA1&digits=6&period=30`;

    return { secret, qrCodeUrl, backupCodes };
  }

  async enable(userId: string, code: string): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.read2fa(userId);
    if (!user?.twoFactorSecret) throw new BadRequestException('Run setup first to get a QR code');
    if (user.twoFactorEnabled) throw new BadRequestException('2FA is already enabled');

    if (!this.verifyCode(user.twoFactorSecret, code)) {
      throw new BadRequestException('Invalid authentication code');
    }

    const codes = user.twoFactorRecoveryCodes.length
      ? user.twoFactorRecoveryCodes
      : this.generateRecoveryCodes();

    await this.write2fa(userId, { twoFactorEnabled: true, twoFactorRecoveryCodes: codes });
    return { message: '2FA enabled successfully', backupCodes: codes };
  }

  async disable(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.read2fa(userId);
    if (!user?.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');

    if (!this.verifyCode(user.twoFactorSecret!, code)) {
      throw new BadRequestException('Invalid authentication code');
    }

    await this.write2fa(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
    });
    return { message: '2FA has been disabled' };
  }

  // ─────────────────────────────────────────────
  // Verify during login
  // ─────────────────────────────────────────────

  async verifyForLogin(userId: string, code: string): Promise<boolean> {
    const user = await this.read2fa(userId).catch(() => null);
    if (!user?.twoFactorEnabled) return true; // 2FA not required
    if (!user.twoFactorSecret) return false;
    return this.verifyCode(user.twoFactorSecret, code);
  }

  async verifyRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
    const user = await this.read2fa(userId);
    const codes = user?.twoFactorRecoveryCodes ?? [];

    const normalised = recoveryCode.toUpperCase().replace(/[-\s]/g, '');
    const index = codes.findIndex(
      (c) => c.toUpperCase().replace(/[-\s]/g, '') === normalised,
    );

    if (index === -1) return false;

    const remaining = [...codes];
    remaining.splice(index, 1);
    await this.write2fa(userId, { twoFactorRecoveryCodes: remaining });
    return true;
  }

  async getStatus(userId: string): Promise<{ enabled: boolean; hasBackupCodes: boolean }> {
    const user = await this.read2fa(userId).catch(() => null);
    return {
      enabled: user?.twoFactorEnabled ?? false,
      hasBackupCodes: (user?.twoFactorRecoveryCodes.length ?? 0) > 0,
    };
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.read2fa(userId);
    if (!user?.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');
    if (!this.verifyCode(user.twoFactorSecret!, code)) {
      throw new BadRequestException('Invalid authentication code');
    }

    const backupCodes = this.generateRecoveryCodes();
    await this.write2fa(userId, { twoFactorRecoveryCodes: backupCodes });
    return { backupCodes };
  }

  // ─────────────────────────────────────────────
  // TOTP internals (RFC 6238 compliant)
  // ─────────────────────────────────────────────

  private generateSecret(): string {
    const bytes = crypto.randomBytes(20);
    return this.base32Encode(bytes);
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );
  }

  verifyCode(secret: string, code: string): boolean {
    const cleaned = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) return false;

    const counter = Math.floor(Date.now() / 1000 / 30);
    for (let delta = -1; delta <= 1; delta++) {
      if (this.computeTotp(secret, counter + delta) === cleaned) return true;
    }
    return false;
  }

  private computeTotp(secret: string, counter: number): string {
    const key = this.base32Decode(secret);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter), 0);
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, '0');
  }

  private base32Encode(buf: Buffer): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    for (const byte of buf) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        result += chars[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) result += chars[(value << (5 - bits)) & 31];
    return result;
  }

  private base32Decode(str: string): Buffer {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = str.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];
    for (const ch of cleaned) {
      const idx = chars.indexOf(ch);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }
}
