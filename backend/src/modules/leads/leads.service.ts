import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../../common/services/mail.service';
import { SmsService } from '../../common/services/sms.service';
import { BranchService } from '../branch/branch.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

export type LeadSource =
  | 'FACEBOOK' | 'INSTAGRAM' | 'GOOGLE' | 'WEBSITE'
  | 'WHATSAPP' | 'MESSENGER' | 'REFERRAL' | 'MANUAL';

export type LeadStatus =
  | 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL_SENT'
  | 'NEGOTIATION' | 'WON' | 'LOST' | 'UNQUALIFIED';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly branchService: BranchService,
  ) {}

  // ─── Create / Ingest ────────────────────────────────────────────────────────

  async ingestLead(dto: CreateLeadDto, companyId: string) {
    // Dedup: check phone OR email already exists for this company
    if (dto.phone || dto.email) {
      const existing = await this.findDuplicate(companyId, dto.phone, dto.email);
      if (existing) {
        return this.mergeLead(existing, dto);
      }
    }

    const lead = await this.prisma.$queryRaw<any[]>`
      INSERT INTO leads (
        "companyId","name","phone","email","city","country",
        "source","platform","campaignName","adName","formId","pageId",
        "adAccountId","keyword","adGroupName","costPerLead","adSpend",
        "utmSource","utmMedium","utmCampaign","utmTerm","utmContent",
        "externalId","notes","customFields","rawPayload","scoreValue",
        "updatedAt"
      ) VALUES (
        ${companyId},${dto.name},${dto.phone ?? null},${dto.email ?? null},
        ${dto.city ?? null},${dto.country ?? null},
        ${(dto.source?.toUpperCase() ?? 'MANUAL')}::"LeadSource",
        ${dto.platform ?? null},${dto.campaignName ?? null},${dto.adName ?? null},
        ${dto.formId ?? null},${dto.pageId ?? null},${dto.adAccountId ?? null},
        ${dto.keyword ?? null},${dto.adGroupName ?? null},
        ${dto.costPerLead ?? null},${dto.adSpend ?? null},
        ${dto.utmSource ?? null},${dto.utmMedium ?? null},${dto.utmCampaign ?? null},
        ${dto.utmTerm ?? null},${dto.utmContent ?? null},
        ${dto.externalId ?? null},${dto.notes ?? null},
        ${dto.customFields ? JSON.stringify(dto.customFields) : null}::jsonb,
        ${dto.rawPayload ? JSON.stringify(dto.rawPayload) : null}::jsonb,
        0, NOW()
      )
      RETURNING *
    `;

    const newLead = lead[0];

    // Score the lead
    await this.scoreLead(newLead.id, newLead);

    // Auto assign
    await this.autoAssign(newLead, companyId);

    // Log event
    await this.logEvent(newLead.id, 'CREATED', 'Lead created', {
      source: dto.source,
      campaign: dto.campaignName,
    });

    // Notify
    await this.notifyTeam(newLead, companyId);

    return this.findOne(newLead.id, companyId);
  }

  private async findDuplicate(companyId: string, phone?: string, email?: string) {
    if (!phone && !email) return null;

    const conditions: string[] = [`"companyId" = '${companyId}'`, `"isDeleted" = false`];
    const orClauses: string[] = [];

    if (phone) orClauses.push(`"phone" = '${phone.replace(/'/g, "''")}'`);
    if (email) orClauses.push(`LOWER("email") = LOWER('${email.replace(/'/g, "''")}')`);

    if (orClauses.length === 0) return null;
    conditions.push(`(${orClauses.join(' OR ')})`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM leads WHERE ${conditions.join(' AND ')} LIMIT 1`,
    );

    return results[0] ?? null;
  }

  private async mergeLead(existing: any, dto: CreateLeadDto) {
    // Append new campaign source, preserve history
    const existingSources: string[] = existing.customFields?.sources ?? [];
    const newSource = dto.campaignName || dto.source || 'MANUAL';
    if (!existingSources.includes(newSource)) existingSources.push(newSource);

    await this.prisma.$queryRawUnsafe(
      `UPDATE leads SET
        "name" = COALESCE($1, "name"),
        "phone" = COALESCE($2, "phone"),
        "email" = COALESCE($3, "email"),
        "city" = COALESCE($4, "city"),
        "customFields" = COALESCE("customFields", '{}'::jsonb) || $5::jsonb,
        "updatedAt" = NOW()
      WHERE id = $6`,
      dto.name ?? existing.name,
      dto.phone ?? null,
      dto.email ?? null,
      dto.city ?? null,
      JSON.stringify({ sources: existingSources, lastCampaign: dto.campaignName }),
      existing.id,
    );

    await this.logEvent(existing.id, 'MERGED', 'Duplicate lead merged', {
      newSource: dto.source,
      campaign: dto.campaignName,
    });

    return this.findOne(existing.id, existing.companyId);
  }

  // ─── Score Engine ────────────────────────────────────────────────────────────

  async scoreLead(leadId: string, leadData?: any) {
    const lead = leadData ?? await this.findRaw(leadId);
    if (!lead) return;

    let score = 0;

    if (lead.email) score += 20;
    if (lead.phone) score += 15;
    if (lead.city) score += 10;
    if (lead.campaignName) score += 10;
    if (lead.keyword) score += 15;
    if (lead.source === 'GOOGLE') score += 10;
    if (lead.source === 'FACEBOOK' || lead.source === 'INSTAGRAM') score += 8;
    if (lead.firstReplyAt) {
      const mins = (Date.now() - new Date(lead.firstReplyAt).getTime()) / 60000;
      if (mins < 5) score += 20;
      else if (mins < 60) score += 10;
    }
    if (lead.lastContactedAt) score += 5;

    const scoreLabel =
      score >= 65 ? 'HOT' :
      score >= 35 ? 'WARM' : 'COLD';

    await this.prisma.$queryRawUnsafe(
      `UPDATE leads SET "scoreValue" = $1, "score" = $2::"LeadScore", "updatedAt" = NOW() WHERE id = $3`,
      score, scoreLabel, leadId,
    );
  }

  // ─── Auto Assignment ─────────────────────────────────────────────────────────

  private async autoAssign(lead: any, companyId: string) {
    if (lead.assignedToId) return;

    // Geo-based branch assignment: if lead has lat/lng, route to nearest branch
    if (lead.latitude && lead.longitude) {
      try {
        const nearestBranchId = await this.branchService.findNearestBranch(
          lead.latitude, lead.longitude,
        );
        if (nearestBranchId) {
          await this.prisma.$queryRawUnsafe(
            `UPDATE leads SET "branchId" = $1, "updatedAt" = NOW() WHERE id = $2`,
            nearestBranchId, lead.id,
          );
          await this.logEvent(lead.id, 'BRANCH_ASSIGNED', 'Lead geo-routed to nearest branch', {
            branchId: nearestBranchId,
          });
        }
      } catch (e) {
        this.logger.warn(`Geo-branch assignment failed for lead ${lead.id}: ${e?.message}`);
      }
    }

    const rules = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM lead_assignment_rules
       WHERE "companyId" = $1 AND "isActive" = true
       ORDER BY priority DESC`,
      companyId,
    );

    for (const rule of rules) {
      if (!this.matchesConditions(lead, rule.conditions ?? [])) continue;

      let assignToId: string | null = null;

      if (rule.mode === 'DIRECT' && rule.assignToId) {
        assignToId = rule.assignToId;
      } else if (rule.mode === 'ROUND_ROBIN' && rule.teamIds?.length) {
        assignToId = await this.roundRobinAssign(rule.id, rule.teamIds, companyId);
      }

      if (assignToId) {
        await this.prisma.$queryRawUnsafe(
          `UPDATE leads SET "assignedToId" = $1, "updatedAt" = NOW() WHERE id = $2`,
          assignToId, lead.id,
        );
        await this.prisma.$queryRawUnsafe(
          `UPDATE lead_assignment_rules SET "triggerCount" = "triggerCount" + 1, "updatedAt" = NOW() WHERE id = $1`,
          rule.id,
        );
        await this.logEvent(lead.id, 'ASSIGNED', `Auto-assigned via rule: ${rule.name}`, {
          ruleId: rule.id,
          assignedToId: assignToId,
        });
        break;
      }
    }
  }

  private matchesConditions(lead: any, conditions: any[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((c) => {
      const fieldValue = (lead[c.field] || '').toLowerCase();
      const condValue = (c.value || '').toLowerCase();
      switch (c.operator) {
        case 'contains': return fieldValue.includes(condValue);
        case 'equals':   return fieldValue === condValue;
        case 'starts':   return fieldValue.startsWith(condValue);
        default:         return true;
      }
    });
  }

  private async roundRobinAssign(
    ruleId: string, teamIds: string[], companyId: string,
  ): Promise<string | null> {
    const state = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM assignment_round_robin WHERE "ruleId" = $1`, ruleId,
    );

    const lastIdx = state[0]?.lastUserId
      ? teamIds.indexOf(state[0].lastUserId)
      : -1;
    const nextIdx = (lastIdx + 1) % teamIds.length;
    const nextUserId = teamIds[nextIdx];

    if (state.length === 0) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO assignment_round_robin ("companyId","ruleId","lastUserId","updatedAt")
         VALUES ($1,$2,$3,NOW())`,
        companyId, ruleId, nextUserId,
      );
    } else {
      await this.prisma.$queryRawUnsafe(
        `UPDATE assignment_round_robin SET "lastUserId"=$1,"updatedAt"=NOW() WHERE "ruleId"=$2`,
        nextUserId, ruleId,
      );
    }

    return nextUserId;
  }

  // ─── Notify Team ─────────────────────────────────────────────────────────────

  private async notifyTeam(lead: any, companyId: string) {
    try {
      const assignedToId = lead.assignedToId;
      if (!assignedToId) return;

      await this.notificationService.create({
        userId: assignedToId,
        type: 'SYSTEM' as any,
        title: 'New Lead Assigned',
        message: `${lead.name} via ${lead.source}${lead.campaignName ? ` — ${lead.campaignName}` : ''}`,
        priority: 'HIGH' as any,
        data: { leadId: lead.id, source: lead.source },
        link: `/dashboard/admin/crm/leads/${lead.id}`,
      });

      // Email notification
      const assignedUser = await this.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { email: true, firstName: true, phone: true },
      });

      if (assignedUser?.email) {
        this.mailService.sendLeadAssignmentEmail(assignedUser.email, {
          recipientName: assignedUser.firstName,
          leadName: lead.name,
          leadPhone: lead.phone,
          leadEmail: lead.email,
          source: lead.source,
          campaign: lead.campaignName,
          leadId: lead.id,
        }).catch(() => {});
      }

      if (assignedUser?.phone) {
        this.smsService.sendSms(
          assignedUser.phone,
          `New lead: ${lead.name} (${lead.source}). Phone: ${lead.phone || 'N/A'}. Check RMS now.`,
        ).catch(() => {});
      }
    } catch (err) {
      this.logger.error(`Notify team error: ${err.message}`);
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async findAll(
    companyId: string,
    query: {
      page?: number; limit?: number; search?: string; source?: string;
      status?: string; score?: string; assignedToId?: string;
      campaignName?: string; dateFrom?: string; dateTo?: string;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [`l."companyId" = '${companyId}'`, `l."isDeleted" = false`];

    if (query.search) {
      const s = query.search.replace(/'/g, "''");
      conditions.push(
        `(l."name" ILIKE '%${s}%' OR l."phone" ILIKE '%${s}%' OR l."email" ILIKE '%${s}%' OR l."campaignName" ILIKE '%${s}%')`,
      );
    }
    if (query.source) conditions.push(`l."source" = '${query.source}'::"LeadSource"`);
    if (query.status) conditions.push(`l."status" = '${query.status}'::"LeadStatus"`);
    if (query.score)  conditions.push(`l."score" = '${query.score}'::"LeadScore"`);
    if (query.assignedToId) conditions.push(`l."assignedToId" = '${query.assignedToId}'`);
    if (query.campaignName) {
      const c = query.campaignName.replace(/'/g, "''");
      conditions.push(`l."campaignName" ILIKE '%${c}%'`);
    }
    if (query.dateFrom) conditions.push(`l."createdAt" >= '${query.dateFrom}'::timestamp`);
    if (query.dateTo)   conditions.push(`l."createdAt" <= '${query.dateTo}'::timestamp`);

    const where = conditions.join(' AND ');

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT l.*,
          u."firstName" || ' ' || u."lastName" AS "assignedToName",
          u."email" AS "assignedToEmail"
        FROM leads l
        LEFT JOIN users u ON u.id = l."assignedToId"
        WHERE ${where}
        ORDER BY l."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM leads l WHERE ${where}`,
      ),
    ]);

    return {
      data: rows,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
      pages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    };
  }

  async findOne(id: string, companyId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT l.*,
        u."firstName" || ' ' || u."lastName" AS "assignedToName",
        u."email" AS "assignedToEmail",
        u."phone" AS "assignedToPhone",
        u."avatar" AS "assignedToAvatar"
      FROM leads l
      LEFT JOIN users u ON u.id = l."assignedToId"
      WHERE l.id = $1 AND l."companyId" = $2 AND l."isDeleted" = false
    `, id, companyId);

    if (!rows[0]) throw new NotFoundException('Lead not found');

    const [events, notes] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT le.*, u."firstName" || ' ' || u."lastName" AS "authorName"
         FROM lead_events le
         LEFT JOIN users u ON u.id = le."createdById"
         WHERE le."leadId" = $1 ORDER BY le."createdAt" DESC LIMIT 50`, id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM lead_notes WHERE "leadId" = $1 ORDER BY "createdAt" DESC`, id,
      ),
    ]);

    return { ...rows[0], events, notes };
  }

  private async findRaw(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM leads WHERE id = $1`, id,
    );
    return rows[0] ?? null;
  }

  async update(id: string, companyId: string, dto: UpdateLeadDto, updatedById?: string) {
    const lead = await this.findRaw(id);
    if (!lead || lead.companyId !== companyId) throw new NotFoundException('Lead not found');

    const sets: string[] = ['\"updatedAt\" = NOW()'];
    const params: any[] = [];
    let idx = 1;

    const addField = (col: string, val: any) => {
      if (val !== undefined && val !== null) {
        sets.push(`"${col}" = $${idx++}`);
        params.push(val);
      }
    };

    addField('name', dto.name);
    addField('phone', dto.phone);
    addField('email', dto.email);
    addField('city', dto.city);
    addField('country', dto.country);
    addField('notes', dto.notes);
    addField('assignedToId', dto.assignedToId);

    if (dto.status) {
      sets.push(`"status" = $${idx++}::"LeadStatus"`);
      params.push(dto.status);
      if (dto.status === 'WON') {
        sets.push(`"convertedAt" = NOW()`);
      }
    }
    if (dto.score) {
      sets.push(`"score" = $${idx++}::"LeadScore"`);
      params.push(dto.score);
    }

    params.push(id);
    await this.prisma.$queryRawUnsafe(
      `UPDATE leads SET ${sets.join(', ')} WHERE id = $${idx}`,
      ...params,
    );

    if (dto.status && dto.status !== lead.status) {
      await this.logEvent(id, 'STATUS_CHANGED', `Status: ${lead.status} → ${dto.status}`, {
        from: lead.status, to: dto.status, updatedById,
      });
    }
    if (dto.assignedToId && dto.assignedToId !== lead.assignedToId) {
      await this.logEvent(id, 'ASSIGNED', 'Lead reassigned', {
        from: lead.assignedToId, to: dto.assignedToId, updatedById,
      });
      await this.notifyTeam({ ...lead, ...dto }, companyId);
    }

    await this.scoreLead(id);
    return this.findOne(id, companyId);
  }

  async addNote(leadId: string, companyId: string, content: string, authorId: string) {
    const lead = await this.findRaw(leadId);
    if (!lead || lead.companyId !== companyId) throw new NotFoundException('Lead not found');

    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { firstName: true, lastName: true },
    });

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO lead_notes ("leadId","content","authorId","authorName") VALUES ($1,$2,$3,$4)`,
      leadId, content, authorId, user ? `${user.firstName} ${user.lastName}` : 'Staff',
    );

    await this.logEvent(leadId, 'NOTE_ADDED', 'Note added', { authorId });
    await this.prisma.$queryRawUnsafe(
      `UPDATE leads SET "lastContactedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, leadId,
    );

    return this.findOne(leadId, companyId);
  }

  async softDelete(id: string, companyId: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE leads SET "isDeleted" = true, "deletedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1 AND "companyId" = $2`, id, companyId,
    );
  }

  // ─── Assignment Rules ────────────────────────────────────────────────────────

  async getAssignmentRules(companyId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.*, u."firstName" || ' ' || u."lastName" AS "assigneeName"
       FROM lead_assignment_rules r
       LEFT JOIN users u ON u.id = r."assignToId"
       WHERE r."companyId" = $1
       ORDER BY r.priority DESC`, companyId,
    );
  }

  async createAssignmentRule(companyId: string, dto: {
    name: string; conditions: any[]; assignToId?: string;
    teamIds?: string[]; mode?: string; priority?: number;
  }) {
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO lead_assignment_rules
        ("companyId","name","conditions","assignToId","teamIds","mode","priority","updatedAt")
       VALUES ($1,$2,$3::jsonb,$4,$5,$6::"AssignmentMode",$7,NOW())
       RETURNING *`,
      companyId,
      dto.name,
      JSON.stringify(dto.conditions ?? []),
      dto.assignToId ?? null,
      dto.teamIds ?? [],
      dto.mode ?? 'DIRECT',
      dto.priority ?? 0,
    );
    return result[0];
  }

  async updateAssignmentRule(ruleId: string, companyId: string, dto: any) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE lead_assignment_rules SET
        "name" = COALESCE($1,"name"),
        "conditions" = COALESCE($2::jsonb,"conditions"),
        "assignToId" = $3,
        "mode" = COALESCE($4::"AssignmentMode","mode"),
        "priority" = COALESCE($5,"priority"),
        "isActive" = COALESCE($6,"isActive"),
        "updatedAt" = NOW()
       WHERE id = $7 AND "companyId" = $8`,
      dto.name ?? null,
      dto.conditions ? JSON.stringify(dto.conditions) : null,
      dto.assignToId ?? null,
      dto.mode ?? null,
      dto.priority ?? null,
      dto.isActive ?? null,
      ruleId, companyId,
    );
  }

  async deleteAssignmentRule(ruleId: string, companyId: string) {
    await this.prisma.$queryRawUnsafe(
      `DELETE FROM lead_assignment_rules WHERE id = $1 AND "companyId" = $2`,
      ruleId, companyId,
    );
  }

  // ─── Pipeline ────────────────────────────────────────────────────────────────

  async getPipelineBoard(companyId: string) {
    const stages: LeadStatus[] = [
      'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST',
    ];

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT l.*, u."firstName" || ' ' || u."lastName" AS "assignedToName"
      FROM leads l
      LEFT JOIN users u ON u.id = l."assignedToId"
      WHERE l."companyId" = $1 AND l."isDeleted" = false
      ORDER BY l."createdAt" DESC
    `, companyId);

    const board: Record<string, any[]> = {};
    stages.forEach((s) => (board[s] = []));

    for (const row of rows) {
      if (board[row.status]) board[row.status].push(row);
    }

    return board;
  }

  async moveLeadStatus(leadId: string, companyId: string, newStatus: string, userId: string) {
    return this.update(leadId, companyId, { status: newStatus }, userId);
  }

  // ─── Reports ─────────────────────────────────────────────────────────────────

  async getReports(companyId: string, dateFrom?: string, dateTo?: string) {
    const dateFilter = dateFrom && dateTo
      ? `AND "createdAt" BETWEEN '${dateFrom}'::timestamp AND '${dateTo}'::timestamp`
      : '';

    const [bySource, byStatus, byCampaign, totals, daily] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "source", COUNT(*)::int AS leads,
          COUNT(*) FILTER (WHERE status = 'WON')::int AS converted,
          COALESCE(SUM("costPerLead"),0)::numeric AS totalCost
        FROM leads
        WHERE "companyId" = $1 AND "isDeleted" = false ${dateFilter}
        GROUP BY "source" ORDER BY leads DESC
      `, companyId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "status", COUNT(*)::int AS count
        FROM leads
        WHERE "companyId" = $1 AND "isDeleted" = false ${dateFilter}
        GROUP BY "status"
      `, companyId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "campaignName", COUNT(*)::int AS leads,
          COUNT(*) FILTER (WHERE status = 'WON')::int AS converted,
          COALESCE(SUM("costPerLead"),0)::numeric AS totalCost
        FROM leads
        WHERE "companyId" = $1 AND "isDeleted" = false AND "campaignName" IS NOT NULL ${dateFilter}
        GROUP BY "campaignName" ORDER BY leads DESC LIMIT 20
      `, companyId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int AS totalLeads,
          COUNT(*) FILTER (WHERE status = 'WON')::int AS converted,
          COUNT(*) FILTER (WHERE status = 'LOST')::int AS lost,
          COUNT(*) FILTER (WHERE score = 'HOT')::int AS hot,
          COUNT(*) FILTER (WHERE score = 'WARM')::int AS warm,
          COUNT(*) FILTER (WHERE score = 'COLD')::int AS cold,
          COALESCE(AVG(EXTRACT(EPOCH FROM ("firstReplyAt" - "createdAt"))/60),0)::numeric AS avgReplyMinutes,
          COALESCE(SUM("costPerLead"),0)::numeric AS totalAdSpend
        FROM leads
        WHERE "companyId" = $1 AND "isDeleted" = false ${dateFilter}
      `, companyId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT DATE("createdAt") AS date, COUNT(*)::int AS leads
        FROM leads
        WHERE "companyId" = $1 AND "isDeleted" = false ${dateFilter}
        GROUP BY DATE("createdAt") ORDER BY date ASC
      `, companyId),
    ]);

    return {
      totals: totals[0] ?? {},
      bySource,
      byStatus,
      byCampaign,
      daily,
    };
  }

  async getStaffPerformance(companyId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        u.id, u."firstName" || ' ' || u."lastName" AS name, u.email,
        COUNT(l.id)::int AS totalLeads,
        COUNT(l.id) FILTER (WHERE l.status = 'WON')::int AS won,
        COUNT(l.id) FILTER (WHERE l.status = 'CONTACTED')::int AS contacted,
        COALESCE(AVG(EXTRACT(EPOCH FROM (l."firstReplyAt" - l."createdAt"))/60),0)::numeric AS avgReplyMins
      FROM users u
      LEFT JOIN leads l ON l."assignedToId" = u.id AND l."companyId" = $1 AND l."isDeleted" = false
      WHERE u."companyId" = $1
      GROUP BY u.id, u."firstName", u."lastName", u.email
      ORDER BY "totalLeads" DESC
    `, companyId);
  }

  // ─── Lead Forms ──────────────────────────────────────────────────────────────

  async createLeadForm(companyId: string, dto: { name: string; fields: any[]; settings?: any }) {
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO lead_forms ("companyId","name","fields","settings","updatedAt")
       VALUES ($1,$2,$3::jsonb,$4::jsonb,NOW()) RETURNING *`,
      companyId, dto.name, JSON.stringify(dto.fields), JSON.stringify(dto.settings ?? {}),
    );
    return result[0];
  }

  async getLeadForms(companyId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM lead_forms WHERE "companyId" = $1 ORDER BY "createdAt" DESC`, companyId,
    );
  }

  async submitWebsiteForm(formId: string, payload: Record<string, any>, companyId: string) {
    const form = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM lead_forms WHERE id = $1 AND "companyId" = $2 AND "isActive" = true`,
      formId, companyId,
    );
    if (!form[0]) throw new NotFoundException('Form not found');

    const dto: CreateLeadDto = {
      name: payload.name || payload.fullName || 'Unknown',
      phone: payload.phone,
      email: payload.email,
      city: payload.city,
      notes: payload.message,
      source: 'WEBSITE',
      formId,
      campaignName: payload.campaignName,
      utmSource: payload.utm_source,
      utmMedium: payload.utm_medium,
      utmCampaign: payload.utm_campaign,
      rawPayload: payload,
    };

    await this.prisma.$queryRawUnsafe(
      `UPDATE lead_forms SET "leadCount" = "leadCount" + 1, "updatedAt" = NOW() WHERE id = $1`, formId,
    );

    return this.ingestLead(dto, companyId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async logEvent(leadId: string, eventType: string, title: string, metadata?: any) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO lead_events ("leadId","eventType","title","metadata","createdAt")
       VALUES ($1,$2,$3,$4::jsonb,NOW())`,
      leadId, eventType, title, JSON.stringify(metadata ?? {}),
    );
  }
}
