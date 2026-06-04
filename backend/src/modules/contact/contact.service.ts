import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../common/services/mail.service';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly masterPrisma: MasterPrismaService,
  ) {}

  async submitContactForm(dto: CreateContactDto, ip?: string): Promise<{ message: string }> {
    // Persist the enquiry in master DB (best-effort — table may not exist yet)
    try {
      await (this.masterPrisma as any).contactSubmission?.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          phone: dto.phone ?? null,
          message: dto.message,
          ip: ip ?? null,
        },
      });
    } catch {
      // Non-critical — proceed even if persistence fails
    }

    // Retrieve admin email from platform settings or fall back to env
    let adminEmail = this.configService.get<string>('CONTACT_ADMIN_EMAIL')
      || this.configService.get<string>('email.from')
      || 'admin@livora-os.com';

    try {
      const setting = await (this.masterPrisma as any).platformSetting?.findUnique({
        where: { key: 'contact_admin_email' },
      });
      if (setting?.value) adminEmail = setting.value as string;
    } catch { /* ignore */ }

    // Send notification to admin (fire-and-forget)
    this.mailService.sendContactFormEmail(adminEmail, dto).catch((err) => {
      this.logger.error(`Failed to send contact form notification: ${err.message}`);
    });

    // Send auto-reply to sender (fire-and-forget)
    this.mailService.sendContactAutoReply(dto.email, dto.name).catch((err) => {
      this.logger.warn(`Failed to send contact auto-reply to ${dto.email}: ${err.message}`);
    });

    return { message: 'Thank you for your message. We will get back to you shortly.' };
  }
}
