import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SaleStatus } from '@prisma/client';

@Injectable()
export class SaleOverdueService {
  private readonly logger = new Logger(SaleOverdueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkOverduePayments() {
    this.logger.log('Checking for overdue payments...');

    const now = new Date();

    const overdueSales = await this.prisma.sale.findMany({
      where: {
        paymentPlan: 'INSTALLMENT',
        status: SaleStatus.IN_PROGRESS,
        remainingBalance: { gt: 0 },
        nextPaymentDue: { lt: now },
      },
      include: {
        property: { select: { title: true } },
        realtor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (overdueSales.length === 0) {
      this.logger.log('No overdue payments found.');
      return;
    }

    this.logger.log(`Found ${overdueSales.length} overdue sale(s).`);

    // Get all admin users
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });

    for (const sale of overdueSales) {
      const overdueDays = Math.floor(
        (now.getTime() - new Date(sale.nextPaymentDue!).getTime()) / (1000 * 60 * 60 * 24),
      );
      const priority = overdueDays > 7 ? 'URGENT' : 'HIGH';
      const remainingBalance = Number(sale.remainingBalance);
      const clientName = `${sale.client.user.firstName} ${sale.client.user.lastName}`;
      const propertyTitle = sale.property.title;

      // Notify all admins
      for (const admin of admins) {
        await this.notificationService.create({
          userId: admin.id,
          type: 'PAYMENT',
          title: 'Overdue Payment Alert',
          message: `${clientName}'s payment for "${propertyTitle}" is ${overdueDays} day(s) overdue. Remaining balance: ₦${remainingBalance.toLocaleString()}`,
          priority,
          data: { saleId: sale.id, overdueDays },
          link: `/admin/sales`,
        });
      }

      // Notify the realtor if one is assigned
      if (sale.realtor) {
        await this.notificationService.create({
          userId: sale.realtor.userId,
          type: 'PAYMENT',
          title: 'Client Payment Overdue',
          message: `${clientName}'s payment for "${propertyTitle}" is ${overdueDays} day(s) overdue. Remaining: ₦${remainingBalance.toLocaleString()}`,
          priority,
          data: { saleId: sale.id, overdueDays },
          link: `/realtor/sales`,
        });
      }

      // Notify the client
      await this.notificationService.create({
        userId: sale.client.userId,
        type: 'PAYMENT',
        title: 'Payment Reminder',
        message: `Your payment for "${propertyTitle}" is ${overdueDays} day(s) overdue. Remaining balance: ₦${remainingBalance.toLocaleString()}. Please make your payment as soon as possible.`,
        priority,
        data: { saleId: sale.id, overdueDays },
        link: `/client/payments`,
      });
    }

    this.logger.log(`Sent overdue notifications for ${overdueSales.length} sale(s).`);
  }
}
