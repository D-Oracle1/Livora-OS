import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const DEFAULT_COMMISSION_RATES = {
  BRONZE: 0.03,
  SILVER: 0.035,
  GOLD: 0.04,
  PLATINUM: 0.05,
};

const DEFAULT_TAX_RATES = {
  incomeTax: 0,
  withholdingTax: 0.10,
  vat: 0.075,
  stampDuty: 0.005,
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetting(key: string): Promise<any> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  }

  async upsertSetting(key: string, value: any): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getCommissionRates(): Promise<Record<string, number>> {
    const rates: Record<string, number> = { ...DEFAULT_COMMISSION_RATES };

    for (const tier of Object.keys(DEFAULT_COMMISSION_RATES)) {
      const val = await this.getSetting(`commission_${tier.toLowerCase()}`);
      if (val !== null) {
        rates[tier] = typeof val === 'number' ? val : Number(val);
      }
    }

    return rates;
  }

  async updateCommissionRates(rates: Record<string, number>): Promise<Record<string, number>> {
    for (const [tier, rate] of Object.entries(rates)) {
      const key = `commission_${tier.toLowerCase()}`;
      await this.upsertSetting(key, rate);
    }
    return this.getCommissionRates();
  }

  async getTaxRates(): Promise<Record<string, number>> {
    const defaults = { ...DEFAULT_TAX_RATES };

    for (const key of Object.keys(defaults)) {
      const val = await this.getSetting(`tax_${key}`);
      if (val !== null) {
        defaults[key as keyof typeof defaults] = typeof val === 'number' ? val : Number(val);
      }
    }

    return defaults;
  }

  async updateTaxRates(rates: Record<string, number>): Promise<Record<string, number>> {
    for (const [key, rate] of Object.entries(rates)) {
      await this.upsertSetting(`tax_${key}`, rate);
    }
    return this.getTaxRates();
  }

  // Legacy key support: the seed uses 'tax_rate' for the main income tax
  async getMainTaxRate(): Promise<number> {
    const val = await this.getSetting('tax_incomeTax');
    if (val !== null) return typeof val === 'number' ? val : Number(val);

    const legacy = await this.getSetting('tax_rate');
    if (legacy !== null) return typeof legacy === 'number' ? legacy : Number(legacy);

    return DEFAULT_TAX_RATES.incomeTax;
  }

  async getPayrollSettings(): Promise<{
    enablePension: boolean;
    pensionRate: number;
    enableTax: boolean;
    taxRate: number;
  }> {
    const [enablePension, pensionRate, enableTax, taxRate] = await Promise.all([
      this.getSetting('payroll_enablePension'),
      this.getSetting('payroll_pensionRate'),
      this.getSetting('payroll_enableTax'),
      this.getSetting('payroll_taxRate'),
    ]);

    return {
      enablePension: enablePension !== null ? Boolean(enablePension) : true,
      pensionRate: pensionRate !== null ? Number(pensionRate) : 0.08,
      enableTax: enableTax !== null ? Boolean(enableTax) : true,
      taxRate: taxRate !== null ? Number(taxRate) : 0.075,
    };
  }

  async updatePayrollSettings(settings: {
    enablePension?: boolean;
    pensionRate?: number;
    enableTax?: boolean;
    taxRate?: number;
  }): Promise<{ enablePension: boolean; pensionRate: number; enableTax: boolean; taxRate: number }> {
    const updates: Promise<void>[] = [];
    if (settings.enablePension !== undefined) updates.push(this.upsertSetting('payroll_enablePension', settings.enablePension));
    if (settings.pensionRate !== undefined) updates.push(this.upsertSetting('payroll_pensionRate', settings.pensionRate));
    if (settings.enableTax !== undefined) updates.push(this.upsertSetting('payroll_enableTax', settings.enableTax));
    if (settings.taxRate !== undefined) updates.push(this.upsertSetting('payroll_taxRate', settings.taxRate));
    await Promise.all(updates);
    return this.getPayrollSettings();
  }

  // ============ Notification Preferences ============

  private readonly DEFAULT_NOTIFICATION_PREFS = {
    email: true,
    push: true,
    sms: false,
    systemAlerts: true,
    salesUpdates: true,
    commissionUpdates: true,
    paymentReminders: true,
    hrAlerts: true,
    marketingEmails: false,
  };

  async getNotificationPreferences(userId: string): Promise<Record<string, boolean>> {
    const val = await this.getSetting(`notif_prefs_${userId}`);
    if (!val) return { ...this.DEFAULT_NOTIFICATION_PREFS };
    return { ...this.DEFAULT_NOTIFICATION_PREFS, ...(typeof val === 'object' ? val : {}) };
  }

  async updateNotificationPreferences(
    userId: string,
    prefs: Partial<Record<string, boolean>>,
  ): Promise<Record<string, boolean>> {
    const current = await this.getNotificationPreferences(userId);
    const allowed = Object.keys(this.DEFAULT_NOTIFICATION_PREFS);
    const sanitized: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(prefs)) {
      if (allowed.includes(k) && typeof v === 'boolean') {
        sanitized[k] = v;
      }
    }
    const merged = { ...current, ...sanitized };
    await this.upsertSetting(`notif_prefs_${userId}`, merged);
    return merged;
  }

  async isNotificationEnabled(userId: string, channel: string): Promise<boolean> {
    const prefs = await this.getNotificationPreferences(userId);
    return prefs[channel] !== false; // default to enabled
  }
}
