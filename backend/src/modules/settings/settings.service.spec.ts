import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../database/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockSetting = (key: string, value: any) => ({ key, value, id: 'id', createdAt: new Date(), updatedAt: new Date() });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: {
            systemSetting: {
              findUnique: jest.fn(),
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCommissionRates', () => {
    it('should return default rates when no settings stored', async () => {
      (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null);
      const rates = await service.getCommissionRates();
      expect(rates.BRONZE).toBe(0.03);
      expect(rates.GOLD).toBe(0.04);
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return default prefs for new user', async () => {
      (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null);
      const prefs = await service.getNotificationPreferences('user-1');
      expect(prefs.email).toBe(true);
      expect(prefs.sms).toBe(false);
    });

    it('should merge stored prefs with defaults', async () => {
      (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(
        mockSetting('notif_prefs_user-1', { email: false, push: true }),
      );
      const prefs = await service.getNotificationPreferences('user-1');
      expect(prefs.email).toBe(false); // overridden
      expect(prefs.systemAlerts).toBe(true); // default
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should only update allowed keys', async () => {
      (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null);
      const updated = await service.updateNotificationPreferences('user-1', {
        email: false,
        unknownKey: true,
      } as any);
      expect(updated.email).toBe(false);
      expect((updated as any).unknownKey).toBeUndefined();
    });
  });

  describe('isNotificationEnabled', () => {
    it('should default to enabled for unknown channels', async () => {
      (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null);
      const enabled = await service.isNotificationEnabled('user-1', 'email');
      expect(enabled).toBe(true);
    });
  });
});
