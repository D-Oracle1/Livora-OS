import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { EventStatus } from '@prisma/client';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly HOMEPAGE_CACHE_TTL = 120; // seconds
  private readonly EVENT_CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── SLUG GENERATION ────────────────────────────────────────────────────────

  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
    const suffix = Date.now().toString(36);
    return `${base}-${suffix}`;
  }

  private async ensureUniqueSlug(slug: string): Promise<string> {
    const exists = await this.prisma.event.findUnique({ where: { slug } });
    if (!exists) return slug;
    // Append timestamp to force uniqueness
    return `${slug.slice(0, 70)}-${Date.now().toString(36)}`;
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────

  async create(dto: CreateEventDto, userId: string) {
    const eventDate = new Date(dto.eventDate);
    if (eventDate <= new Date()) {
      throw new BadRequestException('Event date must be in the future');
    }

    if (dto.registrationDeadline) {
      const deadline = new Date(dto.registrationDeadline);
      if (deadline >= eventDate) {
        throw new BadRequestException('Registration deadline must be before the event date');
      }
    }

    let slug = await this.ensureUniqueSlug(this.generateSlug(dto.title));

    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        locationType: dto.locationType as any,
        locationDetails: dto.locationDetails,
        eventDate,
        registrationDeadline: dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : null,
        maxAttendees: dto.maxAttendees ?? null,
        isFeatured: dto.isFeatured ?? false,
        createdBy: userId,
        formFields: dto.formFields?.length
          ? {
              create: dto.formFields.map((f, i) => ({
                label: f.label,
                fieldType: f.fieldType as any,
                isRequired: f.isRequired ?? false,
                options: (f.options ?? null) as any,
                orderIndex: f.orderIndex ?? i,
              })),
            }
          : undefined,
      },
      include: { formFields: { orderBy: { orderIndex: 'asc' } } },
    });

    // Initialise analytics row
    await this.prisma.eventAnalytics.create({ data: { eventId: event.id } });

    await this.invalidateHomepageCache();
    return event;
  }

  // ── LIST (admin) ───────────────────────────────────────────────────────────

  async findAll(query: EventQueryDto) {
    const { search, status, isFeatured, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, events] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ eventDate: 'asc' }],
        include: {
          _count: { select: { registrations: true } },
          analytics: { select: { viewsCount: true, registrationsCount: true } },
        },
      }),
    ]);

    return {
      data: events,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── GET BY ID (admin) ──────────────────────────────────────────────────────

  async findById(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        formFields: { orderBy: { orderIndex: 'asc' } },
        analytics: true,
        _count: { select: { registrations: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // ── GET BY SLUG (public) ───────────────────────────────────────────────────

  async findBySlug(slug: string) {
    const cacheKey = `event:slug:${slug}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        formFields: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { registrations: true } },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    // Public endpoint must not expose draft events
    if (event.status === EventStatus.draft) {
      throw new NotFoundException('Event not found');
    }

    // Auto-close if deadline passed or capacity reached (async, no await)
    this.autoCloseIfNeeded(event).catch(() => null);

    await this.cache.set(cacheKey, event, this.EVENT_CACHE_TTL);
    return event;
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (dto.eventDate) {
      const eventDate = new Date(dto.eventDate);
      if (dto.registrationDeadline) {
        const deadline = new Date(dto.registrationDeadline);
        if (deadline >= eventDate) {
          throw new BadRequestException('Registration deadline must be before the event date');
        }
      }
    }

    // Replace form fields atomically if provided
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.formFields !== undefined) {
        await tx.eventFormField.deleteMany({ where: { eventId: id } });
        if (dto.formFields.length > 0) {
          await tx.eventFormField.createMany({
            data: dto.formFields.map((f, i) => ({
              eventId: id,
              label: f.label,
              fieldType: f.fieldType as any,
              isRequired: f.isRequired ?? false,
              options: (f.options ?? null) as any,
              orderIndex: f.orderIndex ?? i,
            })),
          });
        }
      }

      return tx.event.update({
        where: { id },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
          ...(dto.locationType && { locationType: dto.locationType as any }),
          ...(dto.locationDetails !== undefined && { locationDetails: dto.locationDetails }),
          ...(dto.eventDate && { eventDate: new Date(dto.eventDate) }),
          ...(dto.registrationDeadline !== undefined && {
            registrationDeadline: dto.registrationDeadline
              ? new Date(dto.registrationDeadline)
              : null,
          }),
          ...(dto.maxAttendees !== undefined && { maxAttendees: dto.maxAttendees }),
          ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        },
        include: { formFields: { orderBy: { orderIndex: 'asc' } } },
      });
    });

    await this.invalidateEventCache(event.slug);
    await this.invalidateHomepageCache();
    return updated;
  }

  // ── PUBLISH / STATUS CHANGE ────────────────────────────────────────────────

  async updateStatus(id: string, status: EventStatus) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    // Allow reopening a closed event (on-site registration) even if the event
    // date has passed — the admin is intentionally re-opening it for walk-ins.
    // Only enforce the past-date guard when publishing from draft.
    if (status === EventStatus.published && event.status !== EventStatus.closed && event.eventDate <= new Date()) {
      throw new BadRequestException('Cannot publish an event that is already in the past');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status },
    });

    await this.invalidateEventCache(event.slug);
    await this.invalidateHomepageCache();
    return updated;
  }

  // ── SOFT DELETE ────────────────────────────────────────────────────────────

  async remove(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    // Cascade will remove form fields, registrations and analytics
    await this.prisma.event.delete({ where: { id } });
    await this.invalidateEventCache(event.slug);
    await this.invalidateHomepageCache();
    return { message: 'Event deleted successfully' };
  }

  // ── HOMEPAGE PROMOTION ENGINE ──────────────────────────────────────────────

  async getHomepageEvents() {
    const cacheKey = 'events:homepage';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const closingSoonThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

    const [featured, upcoming, closingSoon] = await Promise.all([
      // Featured events
      this.prisma.event.findMany({
        where: { status: EventStatus.published, isFeatured: true, eventDate: { gt: now } },
        orderBy: { eventDate: 'asc' },
        take: 3,
        include: { _count: { select: { registrations: true } } },
      }),

      // Upcoming events (next 10)
      this.prisma.event.findMany({
        where: { status: EventStatus.published, eventDate: { gt: now } },
        orderBy: { eventDate: 'asc' },
        take: 10,
        include: { _count: { select: { registrations: true } } },
      }),

      // Closing soon (deadline within 3 days)
      this.prisma.event.findMany({
        where: {
          status: EventStatus.published,
          eventDate: { gt: now },
          registrationDeadline: { gt: now, lte: closingSoonThreshold },
        },
        orderBy: { registrationDeadline: 'asc' },
        take: 5,
        include: { _count: { select: { registrations: true } } },
      }),
    ]);

    const result = { featured, upcoming, closingSoon };
    await this.cache.set(cacheKey, result, this.HOMEPAGE_CACHE_TTL);
    return result;
  }

  // ── AUTO-CLOSE LOGIC ───────────────────────────────────────────────────────

  private async autoCloseIfNeeded(event: any): Promise<void> {
    const now = new Date();
    let shouldClose = false;

    if (event.registrationDeadline && now > event.registrationDeadline) {
      shouldClose = true;
    }

    if (!shouldClose && event.maxAttendees !== null) {
      const count = await this.prisma.eventRegistration.count({
        where: { eventId: event.id, status: { not: 'rejected' } },
      });
      if (count >= event.maxAttendees) shouldClose = true;
    }

    if (shouldClose && event.status === EventStatus.published) {
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: EventStatus.closed },
      });
      await this.invalidateEventCache(event.slug);
      await this.invalidateHomepageCache();
    }
  }

  // ── CACHE HELPERS ──────────────────────────────────────────────────────────

  private async invalidateEventCache(slug: string): Promise<void> {
    await this.cache.del(`event:slug:${slug}`);
  }

  private async invalidateHomepageCache(): Promise<void> {
    await this.cache.del('events:homepage');
  }
}
