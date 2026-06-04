import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

type Provider = 'META' | 'GOOGLE' | 'WEBSITE';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly encKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encKey = (config.get<string>('encryption.key') || '').padEnd(32, '0').slice(0, 32);
  }

  // ─── Encryption ──────────────────────────────────────────────────────────────

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encKey), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(text: string): string {
    try {
      const [ivHex, encHex] = text.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const enc = Buffer.from(encHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encKey), iv);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      return text;
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async findAll(companyId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id,"companyId","provider","name","providerAccountId","isActive",
              "lastSyncAt","createdAt","updatedAt","settings",
              "tokenExpiresAt",
              CASE WHEN "accessToken" IS NOT NULL THEN true ELSE false END AS "hasToken"
       FROM integrations WHERE "companyId" = $1 ORDER BY "createdAt" DESC`,
      companyId,
    );
    return rows;
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM integrations WHERE id = $1 AND "companyId" = $2`, id, companyId,
    );
    if (!rows[0]) throw new NotFoundException('Integration not found');
    const int = { ...rows[0] };
    if (int.accessToken) int.accessToken = this.decrypt(int.accessToken);
    if (int.refreshToken) int.refreshToken = this.decrypt(int.refreshToken);
    return int;
  }

  async create(companyId: string, dto: {
    provider: Provider; name: string; providerAccountId?: string;
    accessToken?: string; refreshToken?: string; tokenExpiresAt?: Date;
    settings?: any;
  }) {
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO integrations
        ("companyId","provider","name","providerAccountId",
         "accessToken","refreshToken","tokenExpiresAt",
         "webhookVerifyToken","settings","updatedAt")
       VALUES ($1,$2::"IntegrationProvider",$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())
       RETURNING *`,
      companyId,
      dto.provider,
      dto.name,
      dto.providerAccountId ?? null,
      dto.accessToken ? this.encrypt(dto.accessToken) : null,
      dto.refreshToken ? this.encrypt(dto.refreshToken) : null,
      dto.tokenExpiresAt ?? null,
      verifyToken,
      JSON.stringify(dto.settings ?? {}),
    );
    const int = result[0];
    return { ...int, webhookVerifyToken: verifyToken, hasToken: !!dto.accessToken };
  }

  async update(id: string, companyId: string, dto: {
    name?: string; accessToken?: string; refreshToken?: string;
    tokenExpiresAt?: Date; isActive?: boolean; settings?: any; lastSyncAt?: Date;
  }) {
    const sets: string[] = ['"updatedAt" = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined)       { sets.push(`"name" = $${idx++}`);        params.push(dto.name); }
    if (dto.isActive !== undefined)   { sets.push(`"isActive" = $${idx++}`);    params.push(dto.isActive); }
    if (dto.lastSyncAt !== undefined) { sets.push(`"lastSyncAt" = $${idx++}`);  params.push(dto.lastSyncAt); }
    if (dto.tokenExpiresAt)           { sets.push(`"tokenExpiresAt" = $${idx++}`); params.push(dto.tokenExpiresAt); }
    if (dto.settings)                 { sets.push(`"settings" = $${idx++}::jsonb`); params.push(JSON.stringify(dto.settings)); }
    if (dto.accessToken)              { sets.push(`"accessToken" = $${idx++}`); params.push(this.encrypt(dto.accessToken)); }
    if (dto.refreshToken)             { sets.push(`"refreshToken" = $${idx++}`); params.push(this.encrypt(dto.refreshToken)); }

    params.push(id, companyId);
    await this.prisma.$queryRawUnsafe(
      `UPDATE integrations SET ${sets.join(', ')} WHERE id = $${idx++} AND "companyId" = $${idx}`,
      ...params,
    );
  }

  async delete(id: string, companyId: string) {
    await this.prisma.$queryRawUnsafe(
      `DELETE FROM integrations WHERE id = $1 AND "companyId" = $2`, id, companyId,
    );
  }

  // ─── Meta OAuth Flow ──────────────────────────────────────────────────────────

  getMetaAuthUrl(companyId: string, state?: string): string {
    const appId = this.config.get<string>('oauth.facebook.appId');
    const redirectUri = encodeURIComponent(
      `${this.config.get('apiUrl')}/api/v1/integrations/meta/callback`,
    );
    const stateParam = encodeURIComponent(JSON.stringify({ companyId, extra: state }));
    const scopes = 'ads_read,leads_retrieval,pages_read_engagement,pages_show_list';
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${stateParam}&scope=${scopes}&response_type=code`;
  }

  async handleMetaCallback(code: string, stateRaw: string): Promise<string> {
    const appId     = this.config.get<string>('oauth.facebook.appId');
    const appSecret = this.config.get<string>('oauth.facebook.appSecret');
    const redirectUri = `${this.config.get('apiUrl')}/api/v1/integrations/meta/callback`;

    // Exchange code → access token
    const tokenUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?client_id=${appId}&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) throw new BadRequestException('Meta OAuth token exchange failed');
    const tokenData = await tokenRes.json() as any;
    const shortToken: string = tokenData.access_token;

    // Exchange short-lived → long-lived token
    const longUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
    const longRes  = await fetch(longUrl);
    const longData = await longRes.json() as any;
    const longToken: string = longData.access_token || shortToken;

    // Fetch user pages
    const pagesRes  = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json() as any;

    let state: any = {};
    try { state = JSON.parse(decodeURIComponent(stateRaw)); } catch { /**/ }
    const companyId: string = state.companyId || '';

    if (!companyId) throw new BadRequestException('Missing companyId in OAuth state');

    // Store each page as an integration
    const pages: any[] = pagesData.data || [];
    for (const page of pages) {
      const existing = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM integrations WHERE "companyId"=$1 AND "provider"='META' AND "providerAccountId"=$2`,
        companyId, page.id,
      );
      if (existing[0]) {
        await this.update(existing[0].id, companyId, {
          accessToken: page.access_token || longToken,
          lastSyncAt: new Date(),
        });
      } else {
        await this.create(companyId, {
          provider: 'META',
          name: page.name || 'Facebook Page',
          providerAccountId: page.id,
          accessToken: page.access_token || longToken,
        });
      }
    }

    // Subscribe each page to leadgen webhooks
    for (const page of pages) {
      await this.subscribePageToWebhook(page.id, page.access_token || longToken).catch((e) =>
        this.logger.warn(`Page webhook subscribe failed: ${e.message}`),
      );
    }

    const frontendUrl = this.config.get<string>('appUrl');
    return `${frontendUrl}/dashboard/admin/crm/integrations?meta=connected`;
  }

  private async subscribePageToWebhook(pageId: string, pageToken: string) {
    const url = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`;
    const body = new URLSearchParams({
      subscribed_fields: 'leadgen,messages',
      access_token: pageToken,
    });
    const res = await fetch(url, { method: 'POST', body });
    const data = await res.json() as any;
    if (!data.success) {
      this.logger.warn(`Page ${pageId} webhook subscribe: ${JSON.stringify(data)}`);
    }
  }

  async refreshMetaToken(integrationId: string, companyId: string) {
    const int = await this.findOne(integrationId, companyId);
    if (!int.accessToken) throw new BadRequestException('No token to refresh');

    const appId     = this.config.get<string>('oauth.facebook.appId');
    const appSecret = this.config.get<string>('oauth.facebook.appSecret');

    const url =
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(int.accessToken)}`;

    const res  = await fetch(url);
    const data = await res.json() as any;
    if (!data.access_token) throw new BadRequestException('Token refresh failed');

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    await this.update(integrationId, companyId, {
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
      lastSyncAt: new Date(),
    });

    return { success: true };
  }

  // ─── Google OAuth Flow ────────────────────────────────────────────────────────

  getGoogleAuthUrl(companyId: string): string {
    const clientId   = this.config.get<string>('oauth.google.clientId');
    const redirectUri = encodeURIComponent(
      `${this.config.get('apiUrl')}/api/v1/integrations/google/callback`,
    );
    const state  = encodeURIComponent(JSON.stringify({ companyId }));
    const scopes = encodeURIComponent(
      'https://www.googleapis.com/auth/adwords ' +
      'https://www.googleapis.com/auth/userinfo.email',
    );
    return (
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}` +
      `&state=${state}&access_type=offline&prompt=consent`
    );
  }

  async handleGoogleCallback(code: string, stateRaw: string): Promise<string> {
    const clientId     = this.config.get<string>('oauth.google.clientId');
    const clientSecret = this.config.get<string>('oauth.google.clientSecret');
    const redirectUri  = `${this.config.get('apiUrl')}/api/v1/integrations/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId!, client_secret: clientSecret!,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new BadRequestException('Google OAuth token exchange failed');
    const tokenData = await tokenRes.json() as any;

    // Fetch email for naming
    const userRes  = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json() as any;

    let state: any = {};
    try { state = JSON.parse(decodeURIComponent(stateRaw)); } catch { /**/ }
    const companyId: string = state.companyId || '';
    if (!companyId) throw new BadRequestException('Missing companyId in OAuth state');

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM integrations WHERE "companyId"=$1 AND "provider"='GOOGLE' AND "providerAccountId"=$2`,
      companyId, userData.email,
    );

    if (existing[0]) {
      await this.update(existing[0].id, companyId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        lastSyncAt: new Date(),
      });
    } else {
      await this.create(companyId, {
        provider: 'GOOGLE',
        name: `Google Ads — ${userData.email}`,
        providerAccountId: userData.email,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
      });
    }

    const frontendUrl = this.config.get<string>('appUrl');
    return `${frontendUrl}/dashboard/admin/crm/integrations?google=connected`;
  }

  async refreshGoogleToken(integrationId: string, companyId: string) {
    const int = await this.findOne(integrationId, companyId);
    if (!int.refreshToken) throw new BadRequestException('No refresh token');

    const clientId     = this.config.get<string>('oauth.google.clientId');
    const clientSecret = this.config.get<string>('oauth.google.clientSecret');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: int.refreshToken,
        client_id: clientId!, client_secret: clientSecret!,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new BadRequestException('Google token refresh failed');
    const data = await res.json() as any;

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    await this.update(integrationId, companyId, {
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
      lastSyncAt: new Date(),
    });

    return { success: true };
  }

  // ─── Token health check ───────────────────────────────────────────────────────

  async checkAndRefreshTokens(companyId: string) {
    const expiring = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM integrations
      WHERE "companyId" = $1 AND "isActive" = true
        AND "tokenExpiresAt" IS NOT NULL
        AND "tokenExpiresAt" < NOW() + INTERVAL '1 day'
    `, companyId);

    for (const int of expiring) {
      try {
        if (int.provider === 'META') {
          await this.refreshMetaToken(int.id, companyId);
        } else if (int.provider === 'GOOGLE') {
          await this.refreshGoogleToken(int.id, companyId);
        }
      } catch (e) {
        this.logger.error(`Auto-refresh failed for ${int.id}: ${e.message}`);
      }
    }
  }

  // ─── Pull Meta lead forms ─────────────────────────────────────────────────────

  async pullMetaLeadForms(integrationId: string, companyId: string) {
    const int = await this.findOne(integrationId, companyId);
    if (!int.accessToken) throw new BadRequestException('No access token');

    const pageId = int.providerAccountId;
    const url = `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?access_token=${encodeURIComponent(int.accessToken)}&fields=id,name,status,leads_count,created_time`;

    const res  = await fetch(url);
    const data = await res.json() as any;
    if (data.error) throw new BadRequestException(data.error.message);

    await this.update(integrationId, companyId, { lastSyncAt: new Date() });
    return data.data ?? [];
  }

  // ─── Decrypt for webhook use ──────────────────────────────────────────────────

  async getDecryptedToken(integrationId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "accessToken" FROM integrations WHERE id = $1`, integrationId,
    );
    if (!rows[0]?.accessToken) return null;
    return this.decrypt(rows[0].accessToken);
  }

  async findByPageId(pageId: string): Promise<any | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM integrations WHERE "providerAccountId" = $1 AND "isActive" = true LIMIT 1`,
      pageId,
    );
    if (!rows[0]) return null;
    const int = { ...rows[0] };
    if (int.accessToken) int.accessToken = this.decrypt(int.accessToken);
    return int;
  }

  async findByProvider(companyId: string, provider: Provider) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM integrations WHERE "companyId"=$1 AND "provider"=$2::"IntegrationProvider" AND "isActive"=true`,
      companyId, provider,
    );
    return rows.map((r) => {
      const copy = { ...r };
      if (copy.accessToken) copy.accessToken = this.decrypt(copy.accessToken);
      if (copy.refreshToken) copy.refreshToken = this.decrypt(copy.refreshToken);
      return copy;
    });
  }
}
