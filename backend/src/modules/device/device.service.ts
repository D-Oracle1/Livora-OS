import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: string, data: {
    fcmToken: string;
    deviceType: string;
    deviceName?: string;
  }) {
    try {
      return await this.prisma.userDevice.upsert({
        where: { fcmToken: data.fcmToken },
        update: {
          userId,
          deviceType: data.deviceType,
          deviceName: data.deviceName,
          lastUsedAt: new Date(),
        },
        create: {
          userId,
          fcmToken: data.fcmToken,
          deviceType: data.deviceType,
          deviceName: data.deviceName,
        },
      });
    } catch (err: any) {
      // Table may not exist on this tenant yet (pending migration).
      // Log a warning and return a soft success — device tokens are non-critical.
      this.logger.warn(`Device registration skipped (${err?.code ?? err?.message})`);
      return { success: true, skipped: true };
    }
  }

  async unregisterDevice(fcmToken: string, userId: string) {
    try {
      const device = await this.prisma.userDevice.findUnique({ where: { fcmToken } });
      if (!device) return { success: true };
      if (device.userId !== userId) {
        throw new ForbiddenException('You can only unregister your own devices');
      }
      await this.prisma.userDevice.delete({ where: { fcmToken } });
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.warn(`Device unregistration skipped (${err?.message})`);
    }
    return { success: true };
  }

  async getUserDeviceTokens(userId: string): Promise<string[]> {
    try {
      const devices = await this.prisma.userDevice.findMany({
        where: { userId },
        select: { fcmToken: true },
      });
      return devices.map((d: { fcmToken: string }) => d.fcmToken);
    } catch {
      return [];
    }
  }
}
