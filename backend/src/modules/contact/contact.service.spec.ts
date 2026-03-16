import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { MailService } from '../../common/services/mail.service';
import { ConfigService } from '@nestjs/config';
import { MasterPrismaService } from '../../database/master-prisma.service';

describe('ContactService', () => {
  let service: ContactService;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: MailService,
          useValue: {
            sendContactFormEmail: jest.fn().mockResolvedValue(undefined),
            sendContactAutoReply: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'CONTACT_ADMIN_EMAIL') return 'admin@test.com';
              return def;
            }),
          },
        },
        {
          provide: MasterPrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should submit contact form and send emails', async () => {
    const dto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      message: 'I would like more information about your services.',
    };

    const result = await service.submitContactForm(dto, '127.0.0.1');

    expect(result.message).toContain('Thank you');
    // Emails are fire-and-forget — check they were called
    await new Promise((r) => setTimeout(r, 10));
    expect(mailService.sendContactFormEmail).toHaveBeenCalledWith('admin@test.com', dto);
    expect(mailService.sendContactAutoReply).toHaveBeenCalledWith('jane@example.com', 'Jane Doe');
  });
});
