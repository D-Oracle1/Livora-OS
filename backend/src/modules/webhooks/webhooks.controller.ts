import {
  Controller, Get, Post, Param, Body, Query, Headers, Req,
  HttpCode, HttpStatus, Logger, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Request } from 'express';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { LeadsService } from '../leads/leads.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { PrismaService } from '../../database/prisma.service';

// Track processed webhook event IDs to prevent duplicate processing
const processedEvents = new Set<string>();
const DEDUP_TTL = 10 * 60 * 1000; // 10 minutes

@ApiTags('Webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly leadsService: LeadsService,
    private readonly integrationsService: IntegrationsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Meta Webhook Verification ────────────────────────────────────────────────

  @Get('meta')
  @ApiOperation({ summary: 'Meta webhook verification challenge' })
  verifyMeta(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Req() req: Request,
  ) {
    if (mode !== 'subscribe') throw new BadRequestException('Invalid mode');

    // Accept if verify_token matches any active integration's webhook verify token
    return this.verifyMetaToken(verifyToken, req, challenge);
  }

  private async verifyMetaToken(token: string, req: Request, challenge: string) {
    const row = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM integrations WHERE "webhookVerifyToken" = $1 AND "isActive" = true LIMIT 1`, token,
    );
    if (!row[0]) throw new BadRequestException('Unknown verify token');
    return parseInt(challenge, 10);
  }

  // ─── Meta Webhook Events ──────────────────────────────────────────────────────

  @Post('meta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta webhook event receiver' })
  async receiveMeta(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-hub-signature') signatureLegacy: string,
    @Req() req: Request,
  ) {
    // Verify signature
    const appSecret = this.config.get<string>('oauth.facebook.appSecret');
    if (appSecret && (signature || signatureLegacy)) {
      const rawBody = JSON.stringify(body);
      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature && signature !== expected) {
        this.logger.warn('Meta webhook signature mismatch');
        throw new BadRequestException('Invalid signature');
      }
    }

    if (body.object !== 'page') {
      return { status: 'ignored' };
    }

    // Process asynchronously — respond 200 first
    setImmediate(() => this.processMetaEntries(body.entry ?? []).catch((e) =>
      this.logger.error(`Meta webhook processing error: ${e.message}`),
    ));

    return { status: 'ok' };
  }

  private async processMetaEntries(entries: any[]) {
    for (const entry of entries) {
      const pageId: string = entry.id;

      // Find integration by page ID
      const integration = await this.integrationsService.findByPageId(pageId);
      if (!integration) {
        this.logger.warn(`No integration found for page ${pageId}`);
        continue;
      }

      // Process leadgen changes
      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen') {
          await this.handleMetaLeadgen(change.value, integration).catch((e) =>
            this.logger.error(`Leadgen error: ${e.message}`),
          );
        } else if (change.field === 'messages') {
          await this.handleMetaMessage(change.value, integration).catch((e) =>
            this.logger.error(`Message lead error: ${e.message}`),
          );
        }
      }

      // Process messaging (DMs)
      for (const messaging of entry.messaging ?? []) {
        await this.handleMetaDM(messaging, integration).catch((e) =>
          this.logger.error(`DM error: ${e.message}`),
        );
      }
    }
  }

  private async handleMetaLeadgen(value: any, integration: any) {
    const leadgenId: string = value.leadgen_id;
    if (!leadgenId) return;

    // Dedup
    const eventKey = `meta_lead_${leadgenId}`;
    if (processedEvents.has(eventKey)) return;
    processedEvents.add(eventKey);
    setTimeout(() => processedEvents.delete(eventKey), DEDUP_TTL);

    // Fetch full lead data from Meta Graph API
    let leadData: any = {};
    try {
      const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(integration.accessToken)}&fields=id,created_time,field_data,ad_name,adset_name,campaign_name,form_id,page_id,platform`;
      const res  = await fetch(url);
      leadData   = await res.json();
      if (leadData.error) {
        this.logger.error(`Meta lead fetch error: ${JSON.stringify(leadData.error)}`);
        return;
      }
    } catch (e) {
      this.logger.error(`Meta lead fetch failed: ${e.message}`);
      return;
    }

    // Parse field_data into key/value map
    const fields: Record<string, string> = {};
    for (const field of leadData.field_data ?? []) {
      fields[field.name] = Array.isArray(field.values) ? field.values[0] : field.values;
    }

    const name =
      fields['full_name'] || fields['name'] ||
      [fields['first_name'], fields['last_name']].filter(Boolean).join(' ') ||
      'Facebook Lead';

    const source = leadData.platform === 'ig'
      ? 'INSTAGRAM' : 'FACEBOOK';

    await this.leadsService.ingestLead({
      name,
      phone: fields['phone_number'] || fields['phone'],
      email: fields['email'],
      city: fields['city'],
      country: fields['country'],
      source,
      platform: leadData.platform || 'facebook',
      campaignName: leadData.campaign_name,
      adName: leadData.ad_name,
      formId: String(leadData.form_id || ''),
      pageId: String(leadData.page_id || ''),
      externalId: leadgenId,
      customFields: { ...fields, adsetName: leadData.adset_name },
      rawPayload: leadData,
    }, integration.companyId);
  }

  private async handleMetaMessage(value: any, integration: any) {
    // Message-based lead intent detection
    const intentKeywords = ['price', 'interested', 'need', 'want', 'cost', 'buy', 'how much', 'available', 'details', 'info'];
    const msgText: string = (value.message?.text || '').toLowerCase();

    if (!intentKeywords.some((kw) => msgText.includes(kw))) return;

    const senderId: string = value.sender?.id;
    if (!senderId) return;

    const eventKey = `meta_msg_${senderId}_${Date.now() - (Date.now() % 300000)}`; // 5-min dedup
    if (processedEvents.has(eventKey)) return;
    processedEvents.add(eventKey);
    setTimeout(() => processedEvents.delete(eventKey), 5 * 60 * 1000);

    // Try to get sender profile
    let senderName = 'Facebook User';
    try {
      const url = `https://graph.facebook.com/v19.0/${senderId}?access_token=${encodeURIComponent(integration.accessToken)}&fields=name`;
      const res  = await fetch(url);
      const data = await res.json() as any;
      if (data.name) senderName = data.name;
    } catch { /**/ }

    await this.leadsService.ingestLead({
      name: senderName,
      source: 'MESSENGER',
      platform: 'facebook_messenger',
      externalId: senderId,
      pageId: String(value.recipient?.id || ''),
      rawPayload: value,
      customFields: { firstMessage: value.message?.text },
    }, integration.companyId);
  }

  private async handleMetaDM(messaging: any, integration: any) {
    const message = messaging.message;
    if (!message || message.is_echo) return;
    await this.handleMetaMessage({ sender: messaging.sender, recipient: messaging.recipient, message }, integration);
  }

  // ─── Google Webhook (Offline Conversions / Lead Form Webhook) ─────────────────

  @Get('google')
  @ApiOperation({ summary: 'Google webhook verification' })
  verifyGoogle(@Query('challenge') challenge: string) {
    // Google uses different verification per API — return challenge as-is
    return challenge || 'ok';
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google Ads lead form webhook receiver' })
  async receiveGoogle(
    @Body() body: any,
    @Headers('x-goog-signature') signature: string,
    @Req() req: Request,
  ) {
    const companyId = req.tenant?.companyId;
    if (!companyId) return { status: 'no_tenant' };

    setImmediate(() => this.processGooglePayload(body, companyId).catch((e) =>
      this.logger.error(`Google webhook error: ${e.message}`),
    ));

    return { status: 'ok' };
  }

  private async processGooglePayload(body: any, companyId: string) {
    const leads: any[] = body.leads ?? (body.lead ? [body.lead] : []);

    for (const lead of leads) {
      const eventKey = `google_lead_${lead.leadId || lead.id}`;
      if (processedEvents.has(eventKey)) continue;
      processedEvents.add(eventKey);
      setTimeout(() => processedEvents.delete(eventKey), DEDUP_TTL);

      const columns: Record<string, string> = {};
      for (const col of lead.columnData ?? []) {
        columns[col.columnId] = col.stringValue || col.values?.[0] || '';
      }

      const name =
        [columns['FULL_NAME'], columns['GIVEN_NAME'], columns['FAMILY_NAME']]
          .filter(Boolean).join(' ') || 'Google Lead';

      await this.leadsService.ingestLead({
        name,
        phone: columns['PHONE_NUMBER'],
        email: columns['EMAIL'],
        city: columns['CITY'],
        source: 'GOOGLE',
        platform: 'google_ads',
        campaignName: lead.campaignName || lead.campaign_name,
        adName: lead.adGroupName || lead.ad_group_name,
        adGroupName: lead.adGroupName,
        keyword: lead.keywordText,
        costPerLead: lead.estimatedCostMicros ? lead.estimatedCostMicros / 1_000_000 : undefined,
        externalId: lead.leadId || lead.id,
        customFields: { ...columns, adId: lead.adId },
        rawPayload: lead,
      }, companyId);
    }
  }

  // ─── Website Form (public endpoint) ──────────────────────────────────────────

  @Post('form/:formId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit embeddable website lead form' })
  async submitForm(
    @Param('formId') formId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const companyId = req.tenant?.companyId;
    if (!companyId) throw new BadRequestException('Unknown company');

    return this.leadsService.submitWebsiteForm(formId, body, companyId);
  }

  // ─── WhatsApp Click-to-Chat lead capture ──────────────────────────────────────

  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp Business webhook receiver' })
  async receiveWhatsApp(@Body() body: any, @Req() req: Request) {
    const companyId = req.tenant?.companyId;
    if (!companyId) return { status: 'no_tenant' };

    setImmediate(() => this.processWhatsAppWebhook(body, companyId).catch((e) =>
      this.logger.error(`WhatsApp webhook error: ${e.message}`),
    ));

    return { status: 'ok' };
  }

  private async processWhatsAppWebhook(body: any, companyId: string) {
    const entries = body.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const msg of messages) {
          const phone: string = msg.from;
          const eventKey = `wa_${phone}_${Date.now() - (Date.now() % 600000)}`; // 10-min dedup
          if (processedEvents.has(eventKey)) continue;
          processedEvents.add(eventKey);
          setTimeout(() => processedEvents.delete(eventKey), 10 * 60 * 1000);

          const contacts = change.value?.contacts ?? [];
          const contact  = contacts.find((c: any) => c.wa_id === phone);
          const name     = contact?.profile?.name || `WhatsApp +${phone}`;

          await this.leadsService.ingestLead({
            name,
            phone: `+${phone}`,
            source: 'WHATSAPP',
            platform: 'whatsapp_business',
            externalId: phone,
            customFields: { firstMessage: msg.text?.body, referral: msg.referral },
            rawPayload: msg,
          }, companyId);
        }
      }
    }
  }
}
