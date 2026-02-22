import { Injectable, Logger } from '@nestjs/common';
import { MasterPrismaService } from '../../database/master-prisma.service';

@Injectable()
export class MasterPlatformService {
  private readonly logger = new Logger(MasterPlatformService.name);

  constructor(private readonly masterPrisma: MasterPrismaService) {}

  async getSettings(key: string): Promise<Record<string, any>> {
    const setting = await this.masterPrisma.masterSetting.findUnique({
      where: { key },
    });
    return (setting?.value as Record<string, any>) || {};
  }

  async updateSettings(key: string, value: Record<string, any>): Promise<Record<string, any>> {
    const existing = await this.masterPrisma.masterSetting.findUnique({
      where: { key },
    });
    const current = (existing?.value as Record<string, any>) || {};
    const merged = { ...current, ...value };

    await this.masterPrisma.masterSetting.upsert({
      where: { key },
      create: { key, value: merged },
      update: { value: merged },
    });

    this.logger.debug(`Platform setting updated: ${key}`);
    return merged;
  }

  async getAllSettings(): Promise<{ branding: Record<string, any>; cms: Record<string, any> }> {
    const [branding, cms] = await Promise.all([
      this.getSettings('platform_branding'),
      this.getSettings('platform_cms'),
    ]);
    return { branding, cms };
  }
}
