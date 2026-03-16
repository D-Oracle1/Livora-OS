import { Test, TestingModule } from '@nestjs/testing';
import { TwoFaService } from './twofa.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('TwoFaService', () => {
  let service: TwoFaService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-1',
    email: 'user@test.com',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorRecoveryCodes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFaService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TwoFaService>(TwoFaService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSetupData', () => {
    it('should generate secret and QR code', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: false,
      });

      const result = await service.generateSetupData('user-1');

      expect(result.secret).toBeTruthy();
      expect(result.qrCodeUrl).toContain('otpauth://totp/');
      expect(result.backupCodes).toHaveLength(8);
    });

    it('should throw if 2FA already enabled', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: true,
      });

      await expect(service.generateSetupData('user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyCode', () => {
    it('should reject non-numeric codes', () => {
      expect(service.verifyCode('SECRET', 'abc123')).toBe(false);
    });

    it('should reject codes with wrong length', () => {
      expect(service.verifyCode('SECRET', '12345')).toBe(false);
      expect(service.verifyCode('SECRET', '1234567')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return disabled status when 2FA is off', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const status = await service.getStatus('user-1');
      expect(status.enabled).toBe(false);
    });
  });

  describe('verifyRecoveryCode', () => {
    it('should consume recovery code on success', async () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        twoFactorRecoveryCodes: codes,
      });

      const result = await service.verifyRecoveryCode('user-1', 'ABCD1234');
      expect(result).toBe(true);
      // Should update with remaining code
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { twoFactorRecoveryCodes: ['EFGH5678'] },
        }),
      );
    });

    it('should return false for invalid code', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        twoFactorRecoveryCodes: ['ABCD1234'],
      });

      const result = await service.verifyRecoveryCode('user-1', 'WRONGCODE');
      expect(result).toBe(false);
    });
  });
});
