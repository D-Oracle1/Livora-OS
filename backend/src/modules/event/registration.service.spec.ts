import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { QrService } from './qr.service';
import { EventAnalyticsService } from './analytics.service';
import { PrismaService } from '../../database/prisma.service';
import { EventStatus, RegistrationStatus } from '@prisma/client';

const mockPrisma = {
  event: { findUnique: jest.fn() },
  eventRegistration: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockQrService = {
  createQr: jest.fn().mockResolvedValue({ token: 'mock-jwt-token', dataUrl: 'data:image/png;base64,...' }),
  verifyToken: jest.fn(),
  generateDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,...'),
};

const mockAnalytics = {
  recomputeRegistrations: jest.fn().mockResolvedValue(undefined),
};

const publishedEvent = {
  id: 'ev-1',
  title: 'Test Event',
  status: EventStatus.published,
  registrationDeadline: null,
  maxAttendees: null,
  formFields: [
    { id: 'f1', label: 'Full Name', fieldType: 'text', isRequired: true, options: null, orderIndex: 0 },
    { id: 'f2', label: 'Email', fieldType: 'email', isRequired: true, options: null, orderIndex: 1 },
  ],
};

describe('RegistrationService', () => {
  let service: RegistrationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QrService, useValue: mockQrService },
        { provide: EventAnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();
    service = module.get<RegistrationService>(RegistrationService);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should throw NotFoundException for missing event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.register('no-ev', { userData: {} })).rejects.toThrow(NotFoundException);
    });

    it('should reject registration for non-published event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...publishedEvent, status: EventStatus.draft });
      await expect(service.register('ev-1', { userData: {} })).rejects.toThrow(BadRequestException);
    });

    it('should reject when deadline has passed', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...publishedEvent,
        registrationDeadline: new Date(Date.now() - 86400000),
      });
      await expect(service.register('ev-1', { userData: {} })).rejects.toThrow(BadRequestException);
    });

    it('should reject when event is full', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...publishedEvent, maxAttendees: 2 });
      mockPrisma.eventRegistration.count.mockResolvedValue(2);
      await expect(
        service.register('ev-1', { userData: { 'Full Name': 'Alice', Email: 'alice@test.com' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when required field is missing', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(publishedEvent);
      mockPrisma.eventRegistration.count.mockResolvedValue(0);
      await expect(
        service.register('ev-1', { userData: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid email format', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(publishedEvent);
      mockPrisma.eventRegistration.count.mockResolvedValue(0);
      await expect(
        service.register('ev-1', { userData: { 'Full Name': 'Bob', Email: 'not-an-email' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate email', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(publishedEvent);
      mockPrisma.eventRegistration.count.mockResolvedValue(0);
      mockPrisma.eventRegistration.findFirst.mockResolvedValue({ id: 'r1' });
      mockPrisma.eventRegistration.findMany.mockResolvedValue([
        { userData: { 'Full Name': 'Alice', Email: 'alice@test.com' } },
      ]);
      await expect(
        service.register('ev-1', {
          userData: { 'Full Name': 'Alice2', Email: 'alice@test.com' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create registration and return QR code', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(publishedEvent);
      mockPrisma.eventRegistration.count.mockResolvedValue(0);
      mockPrisma.eventRegistration.findFirst.mockResolvedValue(null);
      mockPrisma.eventRegistration.create.mockResolvedValue({
        id: 'reg-1',
        registrationCode: 'EVT-CODE',
        status: RegistrationStatus.pending,
        createdAt: new Date(),
      });

      const result = await service.register('ev-1', {
        userData: { 'Full Name': 'John Doe', Email: 'john@example.com' },
      });

      expect(result.registrationCode).toBe('EVT-CODE');
      expect(result.qrCode).toBeDefined();
      expect(mockPrisma.eventRegistration.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── checkIn ───────────────────────────────────────────────────────────────

  describe('checkIn', () => {
    it('should reject invalid QR token', async () => {
      mockQrService.verifyToken.mockImplementation(() => {
        throw new BadRequestException('Invalid or tampered QR code');
      });
      await expect(service.checkIn({ qrToken: 'bad-token' })).rejects.toThrow(BadRequestException);
    });

    it('should reject token not found in DB', async () => {
      mockQrService.verifyToken.mockReturnValue({
        type: 'event-registration',
        eventId: 'ev-1',
        registrationCode: 'EVT-CODE',
      });
      mockPrisma.eventRegistration.findUnique.mockResolvedValue(null);
      await expect(service.checkIn({ qrToken: 'valid-but-missing' })).rejects.toThrow(NotFoundException);
    });

    it('should warn on duplicate scan without failing', async () => {
      mockQrService.verifyToken.mockReturnValue({ type: 'event-registration', eventId: 'ev-1' });
      mockPrisma.eventRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        checkedIn: true,
        checkedInAt: new Date(),
        registrationCode: 'EVT-DUP',
        status: RegistrationStatus.approved,
        eventId: 'ev-1',
        event: { id: 'ev-1', title: 'Test', status: EventStatus.published },
      });
      const result = await service.checkIn({ qrToken: 'dup-token' });
      expect(result.alreadyCheckedIn).toBe(true);
      expect(mockPrisma.eventRegistration.update).not.toHaveBeenCalled();
    });

    it('should mark checked-in successfully', async () => {
      mockQrService.verifyToken.mockReturnValue({ type: 'event-registration', eventId: 'ev-1' });
      mockPrisma.eventRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        checkedIn: false,
        registrationCode: 'EVT-OK',
        status: RegistrationStatus.pending,
        eventId: 'ev-1',
        event: { id: 'ev-1', title: 'Test Event', status: EventStatus.published },
      });
      mockPrisma.eventRegistration.update.mockResolvedValue({
        id: 'reg-1',
        checkedIn: true,
        checkedInAt: new Date(),
        registrationCode: 'EVT-OK',
      });
      const result = await service.checkIn({ qrToken: 'good-token' });
      expect(result.alreadyCheckedIn).toBe(false);
      expect(mockPrisma.eventRegistration.update).toHaveBeenCalledTimes(1);
    });
  });
});
