import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QrService } from './qr.service';
import { EventAnalyticsService } from './analytics.service';
import { CreateRegistrationDto, CheckInDto } from './dto/create-registration.dto';
import { EventStatus, RegistrationStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService,
    private readonly analyticsService: EventAnalyticsService,
  ) {}

  // ── PUBLIC REGISTRATION ────────────────────────────────────────────────────

  async register(eventId: string, dto: CreateRegistrationDto) {
    // 1. Load event with form fields
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { formFields: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.published) {
      throw new BadRequestException('Registration is not open for this event');
    }

    // 2. Check registration deadline
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    // 3. Check capacity
    if (event.maxAttendees !== null) {
      const currentCount = await this.prisma.eventRegistration.count({
        where: { eventId, status: { not: RegistrationStatus.rejected } },
      });
      if (currentCount >= event.maxAttendees) {
        throw new BadRequestException('This event has reached maximum capacity');
      }
    }

    // 4. Validate required form fields
    this.validateFormData(event.formFields as any[], dto.userData);

    // 5. Prevent duplicate registration by email (if an email field exists)
    const emailField = event.formFields.find(
      (f: any) => f.fieldType === 'email',
    );
    if (emailField) {
      const submittedEmail = String(
        dto.userData[emailField.label] || dto.userData['email'] || '',
      ).toLowerCase();
      if (submittedEmail) {
        const existing = await this.prisma.eventRegistration.findFirst({
          where: {
            eventId,
            status: { not: RegistrationStatus.rejected },
          },
        });
        // Walk through existing registrations to check email in userData JSON
        // We do this in-memory to avoid raw SQL
        if (existing) {
          const all = await this.prisma.eventRegistration.findMany({
            where: { eventId, status: { not: RegistrationStatus.rejected } },
            select: { userData: true },
          });
          const duplicate = all.some((r) => {
            const data = r.userData as Record<string, unknown>;
            const storedEmail = String(
              data[emailField.label] || data['email'] || '',
            ).toLowerCase();
            return storedEmail === submittedEmail;
          });
          if (duplicate) {
            throw new ConflictException(
              'A registration with this email already exists for this event',
            );
          }
        }
      }
    }

    // 6. Generate unique registration code
    const registrationCode = `EVT-${Date.now()}-${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    // 7. Generate QR token (sign then generate)
    const { token: qrCodeToken } = await this.qrService.createQr({
      type: 'event-registration',
      eventId,
      registrationCode,
    });

    // 8. Sanitize user data (strip any injected HTML/script tags)
    const sanitizedUserData = this.sanitizeUserData(dto.userData);

    // 9. Persist registration
    const registration = await this.prisma.eventRegistration.create({
      data: {
        eventId,
        registrationCode,
        userData: sanitizedUserData as any,
        qrCodeToken,
        status: RegistrationStatus.pending,
      },
    });

    // 10. Generate QR data URL for response
    const qrDataUrl = await this.qrService.generateDataUrl(qrCodeToken);

    // 11. Fire-and-forget analytics update
    this.analyticsService.recomputeRegistrations(eventId).catch(() => null);

    return {
      registrationCode: registration.registrationCode,
      status: registration.status,
      qrCode: qrDataUrl,
      createdAt: registration.createdAt,
    };
  }

  // ── QR CHECK-IN ────────────────────────────────────────────────────────────

  async checkIn(dto: CheckInDto) {
    // 1. Verify QR token integrity
    const payload = this.qrService.verifyToken(dto.qrToken);

    if (payload.type !== 'event-registration') {
      throw new BadRequestException('Invalid QR code — not a registration QR');
    }

    // 2. Find the registration by QR token (source of truth)
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { qrCodeToken: dto.qrToken },
      include: { event: { select: { id: true, title: true, status: true } } },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found — QR code is invalid');
    }

    // 3. Confirm registration belongs to active event
    if (registration.event.status === EventStatus.draft) {
      throw new BadRequestException('Event is not active');
    }

    // 4. Reject if registration was rejected
    if (registration.status === RegistrationStatus.rejected) {
      throw new BadRequestException('This registration has been rejected');
    }

    // 5. Detect duplicate scan
    if (registration.checkedIn) {
      return {
        alreadyCheckedIn: true,
        checkedInAt: registration.checkedInAt,
        registrationCode: registration.registrationCode,
        message: `Already checked in at ${registration.checkedInAt?.toISOString()}`,
      };
    }

    // 6. Mark checked in
    const updated = await this.prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });

    // 7. Update analytics
    this.analyticsService.recomputeRegistrations(registration.eventId).catch(() => null);

    return {
      alreadyCheckedIn: false,
      checkedInAt: updated.checkedInAt,
      registrationCode: updated.registrationCode,
      eventTitle: registration.event.title,
      message: 'Check-in successful',
    };
  }

  // ── ADMIN: LIST REGISTRATIONS ──────────────────────────────────────────────

  async findByEvent(
    eventId: string,
    page = 1,
    limit = 50,
    status?: string,
  ) {
    const where: any = { eventId };
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [total, registrations] = await Promise.all([
      this.prisma.eventRegistration.count({ where }),
      this.prisma.eventRegistration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: registrations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(id: string, status: RegistrationStatus) {
    const reg = await this.prisma.eventRegistration.findUnique({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    return this.prisma.eventRegistration.update({ where: { id }, data: { status } });
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  private validateFormData(
    formFields: Array<{ label: string; fieldType: string; isRequired: boolean }>,
    userData: Record<string, unknown>,
  ): void {
    const errors: string[] = [];

    for (const field of formFields) {
      const value = userData[field.label];
      if (field.isRequired && (value === undefined || value === null || value === '')) {
        errors.push(`"${field.label}" is required`);
        continue;
      }
      if (!value) continue;

      const strVal = String(value);
      if (field.fieldType === 'email') {
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRx.test(strVal)) {
          errors.push(`"${field.label}" must be a valid email address`);
        }
      }
      if (field.fieldType === 'phone') {
        const phoneRx = /^[+\d\s\-().]{7,20}$/;
        if (!phoneRx.test(strVal)) {
          errors.push(`"${field.label}" must be a valid phone number`);
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  private sanitizeUserData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const scriptRx = /<script[\s\S]*?<\/script>|javascript:/gi;
    for (const [key, value] of Object.entries(data)) {
      const safeKey = String(key).replace(scriptRx, '').trim().slice(0, 200);
      if (typeof value === 'string') {
        sanitized[safeKey] = value.replace(scriptRx, '').trim().slice(0, 2000);
      } else {
        sanitized[safeKey] = value;
      }
    }
    return sanitized;
  }
}
