import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventService } from './event.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { EventStatus } from '@prisma/client';

const mockPrisma: any = {
  event: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  eventFormField: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  eventAnalytics: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  eventRegistration: {
    count: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (p: any) => any) => fn(mockPrisma)),
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

describe('EventService', () => {
  let service: EventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    service = module.get<EventService>(EventService);
  });

  // ── CREATE ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should reject an event date in the past', async () => {
      await expect(
        service.create(
          {
            title: 'Past Event',
            locationType: 'physical',
            eventDate: new Date(Date.now() - 86400000).toISOString(),
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when deadline is after event date', async () => {
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const afterEvent = new Date(Date.now() + 14 * 86400000).toISOString();
      await expect(
        service.create(
          {
            title: 'Test',
            locationType: 'physical',
            eventDate: futureDate,
            registrationDeadline: afterEvent,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create event and initialise analytics row', async () => {
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const createdEvent = { id: 'ev-1', slug: 'test-event', formFields: [] };
      mockPrisma.event.findUnique.mockResolvedValue(null); // slug unique check
      mockPrisma.event.create.mockResolvedValue(createdEvent);
      mockPrisma.eventAnalytics.create.mockResolvedValue({});

      const result = await service.create(
        { title: 'Test Event', locationType: 'physical', eventDate: futureDate },
        'user-1',
      );

      expect(mockPrisma.event.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.eventAnalytics.create).toHaveBeenCalledWith({ data: { eventId: 'ev-1' } });
      expect((result as any).slug).toBe('test-event');
    });
  });

  // ── findBySlug ─────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('should throw NotFoundException for non-existent slug', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('no-event')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for draft events on public route', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'ev-1',
        slug: 'draft-event',
        status: EventStatus.draft,
        formFields: [],
        _count: { registrations: 0 },
      });
      await expect(service.findBySlug('draft-event')).rejects.toThrow(NotFoundException);
    });

    it('should return published event', async () => {
      const ev = {
        id: 'ev-1',
        slug: 'pub-event',
        status: EventStatus.published,
        eventDate: new Date(Date.now() + 86400000),
        registrationDeadline: null,
        maxAttendees: null,
        formFields: [],
        _count: { registrations: 0 },
      };
      mockPrisma.event.findUnique.mockResolvedValue(ev);
      mockPrisma.eventRegistration.count.mockResolvedValue(0);
      const result = await service.findBySlug('pub-event');
      expect((result as any).slug).toBe('pub-event');
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should reject publishing a past event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'ev-1',
        slug: 'old-event',
        eventDate: new Date(Date.now() - 86400000),
        status: EventStatus.draft,
      });
      await expect(
        service.updateStatus('ev-1', EventStatus.published),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('no-id', EventStatus.published),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw NotFoundException for missing event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.remove('no-id')).rejects.toThrow(NotFoundException);
    });

    it('should delete event and invalidate cache', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'ev-1', slug: 'my-event' });
      mockPrisma.event.delete.mockResolvedValue({});
      await service.remove('ev-1');
      expect(mockPrisma.event.delete).toHaveBeenCalledWith({ where: { id: 'ev-1' } });
      expect(mockCache.del).toHaveBeenCalledWith('event:slug:my-event');
      expect(mockCache.del).toHaveBeenCalledWith('events:homepage');
    });
  });
});
