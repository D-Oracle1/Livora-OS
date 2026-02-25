import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../../common/services/mail.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreatePurchaseDto, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: { id: true, title: true, isListed: true },
    });

    if (!property) throw new NotFoundException('Property not found');

    return this.prisma.purchaseEnquiry.create({
      data: {
        propertyId: dto.propertyId,
        userId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        numPlots: dto.numPlots,
        nin: dto.nin,
        address: dto.address,
        nextOfKin: dto.nextOfKin,
        occupation: dto.occupation,
        message: dto.message,
      },
      include: {
        property: { select: { id: true, title: true } },
      },
    });
  }

  async submitPayment(id: string, userId: string) {
    const enquiry = await this.prisma.purchaseEnquiry.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!enquiry) throw new NotFoundException('Purchase enquiry not found');
    if (enquiry.userId !== userId) throw new ForbiddenException('Not your enquiry');

    const updated = await this.prisma.purchaseEnquiry.update({
      where: { id },
      data: {
        status: 'PAYMENT_SUBMITTED',
        paymentSubmittedAt: new Date(),
      },
      include: {
        property: { select: { id: true, title: true } },
      },
    });

    // Fetch branding for email context
    const branding = await this.prisma.systemSetting.findUnique({
      where: { key: 'cms_branding' },
      select: { value: true },
    }).catch(() => null);
    const companyName = branding?.value
      ? (JSON.parse(branding.value as string)?.companyName as string | undefined)
      : undefined;

    // Notify all admin users
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'GENERAL_OVERSEER'] } },
      select: { id: true, email: true },
    });

    const notifyPromises = admins.map(async (admin) => {
      // In-app notification
      await this.notificationService.create({
        userId: admin.id,
        type: 'OFFER',
        title: 'Payment Submitted',
        message: `${enquiry.fullName} has submitted payment for ${enquiry.property.title} (${enquiry.numPlots} plot${enquiry.numPlots > 1 ? 's' : ''}).`,
        priority: 'HIGH',
        data: { enquiryId: id, propertyId: enquiry.propertyId },
        link: '/dashboard/admin/purchases',
      }).catch(() => {});

      // Email notification
      await this.mailService.sendPurchasePaymentNotification(
        admin.email,
        {
          clientName: enquiry.fullName,
          propertyTitle: enquiry.property.title,
          numPlots: enquiry.numPlots,
          phone: enquiry.phone,
          email: enquiry.email,
        },
        companyName,
      ).catch(() => {});
    });

    await Promise.allSettled(notifyPromises);

    return updated;
  }

  async findMyEnquiries(userId: string) {
    return this.prisma.purchaseEnquiry.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            images: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(query: { page?: number; limit?: number; status?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.purchaseEnquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: { select: { id: true, title: true, city: true, state: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.purchaseEnquiry.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
