import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { SaleStatus, PropertyStatus, LoyaltyTier, CommissionStatus, PaymentPlan } from '@prisma/client';
import { CommissionService } from '../commission/commission.service';
import { TaxService } from '../tax/tax.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationService } from '../notification/notification.service';
import { ClientService } from '../client/client.service';
import { SettingsService } from '../settings/settings.service';
import { LedgerService } from '../accounting/ledger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SaleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CommissionService))
    private readonly commissionService: CommissionService,
    @Inject(forwardRef(() => TaxService))
    private readonly taxService: TaxService,
    @Inject(forwardRef(() => LoyaltyService))
    private readonly loyaltyService: LoyaltyService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly settingsService: SettingsService,
    private readonly ledgerService: LedgerService,
  ) {}

  async create(createSaleDto: CreateSaleDto, realtorUserId: string, reporterRole: string = 'REALTOR') {
    // Resolve realtor profile:
    //   REALTOR  → always their own profile
    //   STAFF + realtorId → attribute to that realtor
    //   STAFF + no realtorId → company sale (no realtor)
    let realtorProfile: any = null;

    if (reporterRole === 'STAFF' || reporterRole === 'ADMIN' || reporterRole === 'SUPER_ADMIN') {
      if (createSaleDto.realtorId) {
        realtorProfile = await this.prisma.realtorProfile.findUnique({
          where: { id: createSaleDto.realtorId },
          include: { user: true },
        });
        if (!realtorProfile) {
          throw new BadRequestException('Selected realtor profile not found');
        }
      }
      // No realtorId → company sale; realtorProfile stays null
    } else {
      realtorProfile = await this.prisma.realtorProfile.findUnique({
        where: { userId: realtorUserId },
        include: { user: true },
      });
      if (!realtorProfile) {
        throw new BadRequestException('Realtor profile not found');
      }
    }

    // Get or create client
    let clientProfile = await this.prisma.clientProfile.findFirst({
      where: {
        user: { email: createSaleDto.clientEmail },
      },
    });

    if (!clientProfile) {
      const result = await this.clientService.createClient({
        email: createSaleDto.clientEmail,
        firstName: createSaleDto.clientName.split(' ')[0],
        lastName: createSaleDto.clientName.split(' ').slice(1).join(' ') || '',
        phone: createSaleDto.clientContact,
        realtorId: realtorProfile?.id,
      });
      clientProfile = result as any;
    }

    if (!clientProfile) {
      throw new BadRequestException('Failed to get or create client profile');
    }

    // Commission and tax rates are always read from configurable settings
    const [commissionRates, taxRate] = realtorProfile
      ? await Promise.all([
          this.settingsService.getCommissionRates(),
          this.settingsService.getMainTaxRate(),
        ])
      : [{ [LoyaltyTier.BRONZE]: 0.03 }, 0];
    const commissionRate = realtorProfile
      ? (commissionRates[realtorProfile.loyaltyTier as string] ?? 0.03)
      : 0;

    const isInstallment = createSaleDto.paymentPlan === 'INSTALLMENT';
    const totalSalePrice = Number(createSaleDto.saleValue);
    const firstPaymentAmount = isInstallment
      ? Number(createSaleDto.firstPaymentAmount || 0)
      : totalSalePrice;

    if (isInstallment && firstPaymentAmount <= 0) {
      throw new BadRequestException('First payment amount is required for installment plans');
    }
    if (isInstallment && firstPaymentAmount > totalSalePrice) {
      throw new BadRequestException('First payment cannot exceed total sale price');
    }

    // Commission & tax are based on firstPaymentAmount × rate.
    // For FULL plan firstPaymentAmount = totalSalePrice, so this is the full commission.
    // For INSTALLMENT, sale.commissionAmount starts here and grows with totalPaid as
    // further payments come in (see recordPayment).
    const firstCommission = firstPaymentAmount * commissionRate;
    const firstTax        = firstCommission * taxRate;
    const firstNet        = firstCommission - firstTax;

    // Create the sale as PENDING — admin must approve before financial processing
    const sale = await this.prisma.sale.create({
      data: {
        propertyId: createSaleDto.propertyId,
        realtorId: realtorProfile?.id ?? null,
        clientId: clientProfile.id,
        salePrice: totalSalePrice,
        saleDate: new Date(createSaleDto.saleDate),
        status: SaleStatus.PENDING,
        commissionRate,
        commissionAmount: firstCommission,
        taxRate,
        taxAmount: firstTax,
        netAmount: firstNet,
        paymentPlan: isInstallment ? 'INSTALLMENT' : 'FULL',
        numberOfInstallments: createSaleDto.numberOfInstallments || 1,
        totalPaid: firstPaymentAmount,
        remainingBalance: totalSalePrice - firstPaymentAmount,
        notes: createSaleDto.notes,
        areaSold: createSaleDto.areaSold || null,
        nextPaymentDue: isInstallment && (totalSalePrice - firstPaymentAmount) > 0
          ? new Date(new Date(createSaleDto.saleDate).getTime() + 30 * 24 * 60 * 60 * 1000)
          : null,
      },
      include: {
        property: true,
        realtor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        client: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Record the first payment (pending approval)
    await this.prisma.payment.create({
      data: {
        saleId: sale.id,
        paymentNumber: 1,
        amount: firstPaymentAmount,
        paymentDate: new Date(createSaleDto.saleDate),
        commissionRate,
        commissionAmount: firstCommission,
        taxRate,
        taxAmount: firstTax,
        netCommission: firstNet,
        status: 'PENDING',
        paymentMethod: createSaleDto.paymentMethod,
      },
    });

    // Send notification to admins for approval
    await this.sendSaleNotifications(sale, realtorProfile);

    return sale;
  }

  async approveSale(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        property: true,
        realtor: { include: { user: true } },
        client: { include: { user: true } },
      },
    });

    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Only pending sales can be approved');
    }

    const isInstallment = sale.paymentPlan === 'INSTALLMENT';
    const approvedStatus = isInstallment ? SaleStatus.IN_PROGRESS : SaleStatus.COMPLETED;

    // Update property status
    const areaSold = sale.areaSold || 0;
    const remainingArea = sale.property.area - areaSold;
    const isPartialSale = areaSold > 0 && remainingArea > 0;

    if (isPartialSale) {
      await this.prisma.property.update({
        where: { id: sale.propertyId },
        data: { area: remainingArea },
      });
    } else {
      await this.prisma.property.update({
        where: { id: sale.propertyId },
        data: {
          status: isInstallment ? PropertyStatus.UNDER_CONTRACT : PropertyStatus.SOLD,
          ownerId: sale.clientId,
          isListed: false,
          ...(areaSold > 0 ? { area: Math.max(remainingArea, 0) } : {}),
        },
      });
    }

    // Mark payment as completed
    await this.prisma.payment.updateMany({
      where: { saleId: sale.id },
      data: { status: 'COMPLETED' },
    });

    let points = 0;

    if (sale.realtorId) {
      // Always re-read the current tax rate at approval time so Tax records
      // reflect the configured rate, not whatever was stored at sale creation.
      const currentTaxRate = await this.settingsService.getMainTaxRate();
      const commissionAmount = Number(sale.commissionAmount);
      const taxAmount       = commissionAmount * currentTaxRate;
      const netAmount       = commissionAmount - taxAmount;

      // Correct the sale's tax figures with the live rate
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: { taxRate: currentTaxRate, taxAmount, netAmount },
      });

      // Create commission record and capture the ID for the ledger entry
      const commissionRecord = await this.commissionService.create({
        saleId: sale.id,
        realtorId: sale.realtorId,
        amount: commissionAmount,
        rate: sale.commissionRate,
      });

      // Create tax record using the live rate
      const now = new Date();
      const taxRecord = await this.taxService.create({
        saleId: sale.id,
        realtorId: sale.realtorId,
        amount: taxAmount,
        rate: currentTaxRate,
        year: now.getFullYear(),
        quarter: Math.floor(now.getMonth() / 3) + 1,
      });

      // ── Post to General Ledger (FULL plan only — installments posted per payment) ──
      if (!isInstallment) {
        await Promise.all([
          // Cash received for the full sale
          this.ledgerService.postSalePayment({
            referenceId:   sale.id,
            referenceType: 'SALE',
            amount:        Number(sale.salePrice),
            entryDate:     sale.saleDate,
            saleId:        sale.id,
            description:   `Full payment – ${sale.property?.title ?? sale.id}`,
          }),
          // Commission liability created
          commissionRecord && commissionAmount > 0
            ? this.ledgerService.postCommission({
                referenceId:   (commissionRecord as any).id,
                referenceType: 'COMMISSION',
                amount:        commissionAmount,
                entryDate:     sale.saleDate,
                saleId:        sale.id,
                realtorId:     sale.realtorId,
              })
            : Promise.resolve(),
          // Tax liability created
          taxRecord && taxAmount > 0
            ? this.ledgerService.postTax({
                referenceId:   (taxRecord as any).id,
                referenceType: 'TAX',
                amount:        taxAmount,
                entryDate:     sale.saleDate,
                saleId:        sale.id,
              })
            : Promise.resolve(),
        ]);
      }

      // Award loyalty points
      points = await this.loyaltyService.awardPoints({
        realtorId: sale.realtorId,
        saleId: sale.id,
        saleValue: Number(sale.totalPaid),
      });

      // Update realtor stats
      await this.updateRealtorStats(sale.realtorId);
    }

    // Update sale status and loyalty points
    const updatedSale = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: approvedStatus,
        loyaltyPointsAwarded: points,
        closingDate: approvedStatus === SaleStatus.COMPLETED ? new Date() : undefined,
      },
      include: {
        property: true,
        realtor: { include: { user: { select: { firstName: true, lastName: true } } } },
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Update client stats
    await this.updateClientStats(sale.clientId, Number(sale.totalPaid));

    // Notify the realtor (only if one is credited)
    if (sale.realtorId && sale.realtor) {
      await this.notificationService.create({
        userId: sale.realtor.userId,
        type: 'SALE',
        title: 'Sale Approved',
        message: `Your sale of ${sale.property.title} for ₦${Number(sale.salePrice).toLocaleString()} has been approved!`,
        priority: 'HIGH',
        data: { saleId: sale.id },
        link: `/realtor/sales/${sale.id}`,
      });
    }

    return updatedSale;
  }

  async rejectSale(saleId: string, reason?: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        property: true,
        realtor: { include: { user: true } },
      },
    });

    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Only pending sales can be rejected');
    }

    // Delete pending payment records
    await this.prisma.payment.deleteMany({
      where: { saleId: sale.id },
    });

    // Update sale status
    const updatedSale = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        notes: reason ? (sale.notes ? `${sale.notes}\nRejected: ${reason}` : `Rejected: ${reason}`) : sale.notes,
      },
      include: {
        property: true,
        realtor: { include: { user: { select: { firstName: true, lastName: true } } } },
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Notify the realtor (only if one is credited)
    if (sale.realtorId && sale.realtor) {
      await this.notificationService.create({
        userId: sale.realtor.userId,
        type: 'SALE',
        title: 'Sale Report Rejected',
        message: `Your sale report for ${sale.property.title} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        priority: 'HIGH',
        data: { saleId: sale.id },
        link: `/realtor/sales/${sale.id}`,
      });
    }

    return updatedSale;
  }

  async recordPayment(saleId: string, dto: RecordPaymentDto) {
    // Pre-flight: verify the sale exists and is eligible before entering the transaction
    const salePre = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!salePre) throw new NotFoundException('Sale not found');
    if (salePre.paymentPlan !== 'INSTALLMENT') {
      throw new BadRequestException('This sale does not accept installment payments');
    }
    if (salePre.status === SaleStatus.COMPLETED) {
      throw new BadRequestException('This sale is already fully paid');
    }
    if (salePre.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('This sale has been cancelled');
    }

    // All financial mutations run inside a single transaction to prevent concurrent
    // payments from both passing the balance check and producing a negative balance.
    const payment = await this.prisma.$transaction(async (tx) => {
      // Re-fetch the sale inside the transaction with a fresh read
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          realtor: { include: { user: true } },
          property: true,
          payments: { orderBy: { paymentNumber: 'desc' }, take: 1 },
        },
      });

      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === SaleStatus.COMPLETED) {
        throw new BadRequestException('This sale is already fully paid');
      }

      const paymentAmount = Number(dto.amount);
      const remainingBalance = Number(sale.remainingBalance);

      if (paymentAmount <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }
      if (paymentAmount > remainingBalance) {
        throw new BadRequestException(
          `Payment amount (${paymentAmount}) exceeds remaining balance (${remainingBalance})`,
        );
      }

      // Calculate commission and tax for this payment
      const commissionRate = sale.commissionRate;
      const commissionAmount = paymentAmount * commissionRate;
      const taxRate = sale.taxRate;
      const taxAmount = commissionAmount * taxRate;
      const netCommission = commissionAmount - taxAmount;

      const lastPaymentNumber = sale.payments[0]?.paymentNumber || 0;
      const newTotalPaid = Number(sale.totalPaid) + paymentAmount;
      const newRemainingBalance = Number(sale.salePrice) - newTotalPaid;
      const isFullyPaid = newRemainingBalance <= 0;

      // Updated sale-level commission/tax based on newTotalPaid × rate
      const newSaleCommission = newTotalPaid * commissionRate;
      const newSaleTax        = newSaleCommission * taxRate;
      const newSaleNet        = newSaleCommission - newSaleTax;

      // Create the payment record
      const newPayment = await tx.payment.create({
        data: {
          saleId,
          paymentNumber: lastPaymentNumber + 1,
          amount: paymentAmount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          commissionRate,
          commissionAmount,
          taxRate,
          taxAmount,
          netCommission,
          status: 'COMPLETED',
          paymentMethod: dto.paymentMethod,
          reference: dto.reference,
          notes: dto.notes,
        },
      });

      // Update sale running totals atomically.
      // commissionAmount / taxAmount / netAmount grow with totalPaid × rate so they
      // always reflect commission earned on cash received so far.
      await tx.sale.update({
        where: { id: saleId },
        data: {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          commissionAmount: newSaleCommission,
          taxAmount: newSaleTax,
          netAmount: newSaleNet,
          status: isFullyPaid ? SaleStatus.COMPLETED : SaleStatus.IN_PROGRESS,
          closingDate: isFullyPaid ? new Date() : undefined,
          nextPaymentDue: isFullyPaid
            ? null
            : new Date(new Date(dto.paymentDate || new Date()).getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // If fully paid, mark property as SOLD
      if (isFullyPaid && sale.property.status === PropertyStatus.UNDER_CONTRACT) {
        await tx.property.update({
          where: { id: sale.propertyId },
          data: { status: PropertyStatus.SOLD },
        });
      }

      // Keep Commission and Tax ledger records in sync with the updated sale totals
      await tx.commission.updateMany({
        where: { saleId },
        data: { amount: newSaleCommission },
      });
      await tx.tax.updateMany({
        where: { saleId },
        data: { amount: newSaleTax },
      });

      // ── Post to General Ledger — one entry per payment, per type ──────────────
      // Each installment payment creates its own immutable ledger entries so that
      // revenue is recognised on the actual payment date (true cash-basis accounting).
      const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

      await Promise.all([
        // Cash received for this installment
        this.ledgerService.postSalePayment(
          {
            referenceId:   newPayment.id,
            referenceType: 'PAYMENT',
            amount:        paymentAmount,
            entryDate:     paymentDate,
            saleId,
            description:   `Installment #${lastPaymentNumber + 1}`,
          },
          tx,
        ),
        // Commission earned on this payment
        commissionAmount > 0
          ? this.ledgerService.postCommission(
              {
                referenceId:   newPayment.id,
                referenceType: 'PAYMENT',
                amount:        commissionAmount,
                entryDate:     paymentDate,
                saleId,
                realtorId:     sale.realtorId,
              },
              tx,
            )
          : Promise.resolve(),
        // Tax on the commission for this payment
        taxAmount > 0
          ? this.ledgerService.postTax(
              {
                referenceId:   newPayment.id,
                referenceType: 'PAYMENT',
                amount:        taxAmount,
                entryDate:     paymentDate,
                saleId,
              },
              tx,
            )
          : Promise.resolve(),
      ]);

      return { newPayment, sale, isFullyPaid, lastPaymentNumber, paymentAmount, newRemainingBalance };
    });

    // Post-transaction: non-critical side-effects (stats, notifications)
    const { newPayment, sale, isFullyPaid, lastPaymentNumber, paymentAmount, newRemainingBalance } = payment;

    if (sale.realtorId) {
      await this.updateRealtorStats(sale.realtorId);

      if (sale.realtor) {
        try {
          await this.notificationService.create({
            userId: sale.realtor.userId,
            type: 'SALE',
            title: `Payment Received - ${sale.property.title}`,
            message: `Payment #${lastPaymentNumber + 1} of ₦${paymentAmount.toLocaleString()} received. ${isFullyPaid ? 'Sale completed!' : `Remaining: ₦${newRemainingBalance.toLocaleString()}`}`,
            priority: 'MEDIUM',
            data: { saleId, paymentId: newPayment.id },
          });
        } catch {
          // Notification is best-effort
        }
      }
    }

    return newPayment;
  }

  async getPayments(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
    });

    if (!sale) throw new NotFoundException('Sale not found');

    const payments = await this.prisma.payment.findMany({
      where: { saleId },
      orderBy: { paymentNumber: 'asc' },
    });

    return {
      sale: {
        id: sale.id,
        salePrice: sale.salePrice,
        totalPaid: sale.totalPaid,
        remainingBalance: sale.remainingBalance,
        paymentPlan: sale.paymentPlan,
        numberOfInstallments: sale.numberOfInstallments,
        status: sale.status,
        commissionAmount: sale.commissionAmount,
        taxAmount: sale.taxAmount,
        netAmount: sale.netAmount,
      },
      payments,
    };
  }

  private async updateRealtorStats(realtorId: string) {
    const stats = await this.prisma.sale.aggregate({
      where: {
        realtorId,
        status: { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] },
      },
      _count: { id: true },
      _sum: {
        salePrice: true,
        commissionAmount: true,
        taxAmount: true,
      },
    });

    await this.prisma.realtorProfile.update({
      where: { id: realtorId },
      data: {
        totalSales: stats._count.id,
        totalSalesValue: stats._sum.salePrice || 0,
        totalCommission: stats._sum.commissionAmount || 0,
        totalTaxPaid: stats._sum.taxAmount || 0,
      },
    });
  }

  private async updateClientStats(clientId: string, purchaseValue: number) {
    const client = await this.prisma.clientProfile.findUnique({
      where: { id: clientId },
    });

    if (client) {
      const properties = await this.prisma.property.findMany({
        where: { ownerId: clientId },
      });

      const totalPropertyValue = properties.reduce(
        (sum, p) => sum + Number(p.price),
        0,
      );

      await this.prisma.clientProfile.update({
        where: { id: clientId },
        data: {
          totalPurchaseValue: {
            increment: purchaseValue,
          },
          totalPropertyValue,
        },
      });
    }
  }

  private async sendSaleNotifications(sale: any, realtor: any) {
    // Notify admins — requires approval
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    });

    const reporterName = realtor
      ? `${realtor.user.firstName} ${realtor.user.lastName}`
      : 'Sales team (company sale)';

    for (const admin of admins) {
      await this.notificationService.create({
        userId: admin.id,
        type: 'SALE',
        title: 'New Sale Report — Approval Required',
        message: `${reporterName} reported a sale of ${sale.property.title} for ₦${Number(sale.salePrice).toLocaleString()}. Please review and approve.`,
        priority: 'HIGH',
        data: {
          saleId: sale.id,
          propertyId: sale.propertyId,
          realtorId: sale.realtorId,
          propertyTitle: sale.property.title,
          salePrice: Number(sale.salePrice),
          realtorName: realtor ? `${realtor.user.firstName} ${realtor.user.lastName}` : 'Company',
          clientName: sale.client?.user ? `${sale.client.user.firstName} ${sale.client.user.lastName}` : 'Unknown',
          paymentPlan: sale.paymentPlan,
        },
        link: `/dashboard/admin/sales`,
      });
    }
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    realtorId?: string;
    clientId?: string;
    status?: SaleStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, realtorId, clientId, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (realtorId) where.realtorId = realtorId;
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { saleDate: 'desc' },
        include: {
          property: {
            select: { title: true, address: true, city: true },
          },
          realtor: {
            include: {
              user: {
                select: { firstName: true, lastName: true, avatar: true },
              },
            },
          },
          client: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          payments: {
            orderBy: { paymentNumber: 'asc' },
          },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: sales,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        property: true,
        realtor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        client: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        commission: true,
        tax: true,
        loyaltyPoints: true,
        payments: {
          orderBy: { paymentNumber: 'asc' },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  async updateStatus(id: string, status: SaleStatus, notes?: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        property: true,
        realtor: { include: { user: true } },
        client: { include: { user: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // If confirming a pending sale (changing to COMPLETED or IN_PROGRESS)
    if (status === SaleStatus.COMPLETED && sale.status === SaleStatus.PENDING) {
      // Installment sales cannot jump directly to COMPLETED from PENDING —
      // they must be approved first (which sets them to IN_PROGRESS) and then
      // completed via recordPayment once fully paid.
      if (sale.paymentPlan === PaymentPlan.INSTALLMENT) {
        throw new BadRequestException(
          'Installment sales must be approved via the /approve endpoint. ' +
          'Use PATCH /:id/approve to move an installment sale to IN_PROGRESS.',
        );
      }

      // Update property status to SOLD
      await this.prisma.property.update({
        where: { id: sale.propertyId },
        data: {
          status: PropertyStatus.SOLD,
          ownerId: sale.clientId,
          isListed: false,
        },
      });

      if (sale.realtorId && sale.realtor) {
        // Always re-read the current tax rate at approval time
        const currentTaxRate   = await this.settingsService.getMainTaxRate();
        const commissionAmount = Number(sale.commissionAmount);
        const taxAmount        = commissionAmount * currentTaxRate;
        const netAmount        = commissionAmount - taxAmount;

        // Correct the sale's tax figures with the live rate
        await this.prisma.sale.update({
          where: { id: sale.id },
          data: { taxRate: currentTaxRate, taxAmount, netAmount },
        });

        // Create commission record if not exists
        const existingCommission = await this.prisma.commission.findUnique({
          where: { saleId: sale.id },
        });

        if (!existingCommission) {
          await this.commissionService.create({
            saleId: sale.id,
            realtorId: sale.realtorId,
            amount: commissionAmount,
            rate: sale.commissionRate,
          });
        }

        // Upsert tax record using the live rate
        const existingTax = await this.prisma.tax.findUnique({
          where: { saleId: sale.id },
        });
        const now = new Date();

        if (!existingTax) {
          await this.taxService.create({
            saleId: sale.id,
            realtorId: sale.realtorId,
            amount: taxAmount,
            rate: currentTaxRate,
            year: now.getFullYear(),
            quarter: Math.floor(now.getMonth() / 3) + 1,
          });
        } else {
          await this.prisma.tax.update({
            where: { saleId: sale.id },
            data: { amount: taxAmount, rate: currentTaxRate },
          });
        }

        // Award loyalty points if not already awarded
        if (!sale.loyaltyPointsAwarded || sale.loyaltyPointsAwarded === 0) {
          const points = await this.loyaltyService.awardPoints({
            realtorId: sale.realtorId,
            saleId: sale.id,
            saleValue: Number(sale.salePrice),
          });

          await this.prisma.sale.update({
            where: { id: sale.id },
            data: { loyaltyPointsAwarded: points },
          });
        }

        // Update realtor stats
        await this.updateRealtorStats(sale.realtorId);

        // Send confirmation notification to realtor
        await this.notificationService.create({
          userId: sale.realtor.userId,
          type: 'SALE',
          title: 'Sale Confirmed',
          message: `Your sale of ${sale.property.title} has been confirmed!`,
          priority: 'HIGH',
          data: { saleId: sale.id },
          link: `/realtor/sales/${sale.id}`,
        });
      }

      // Update client stats
      await this.updateClientStats(sale.clientId, Number(sale.salePrice));
    }

    // If cancelling a sale
    if (status === SaleStatus.CANCELLED) {
      // Restore areaSold to property if applicable
      if (sale.areaSold && sale.areaSold > 0) {
        await this.prisma.property.update({
          where: { id: sale.propertyId },
          data: {
            area: { increment: sale.areaSold },
          },
        });
      }

      // Revert property status if it was marked as sold
      if (sale.property.status === PropertyStatus.SOLD || sale.property.status === PropertyStatus.UNDER_CONTRACT) {
        await this.prisma.property.update({
          where: { id: sale.propertyId },
          data: {
            status: PropertyStatus.AVAILABLE,
            ownerId: null,
            isListed: true,
          },
        });
      }

      // Notify realtor if one is assigned
      if (sale.realtor) {
        await this.notificationService.create({
          userId: sale.realtor.userId,
          type: 'SALE',
          title: 'Sale Cancelled',
          message: `The sale of ${sale.property.title} has been cancelled.`,
          priority: 'HIGH',
          data: { saleId: sale.id },
          link: `/realtor/sales/${sale.id}`,
        });
      }
    }

    // Update the sale status
    const updatedSale = await this.prisma.sale.update({
      where: { id },
      data: {
        status,
        notes: notes ? (sale.notes ? `${sale.notes}\n${notes}` : notes) : sale.notes,
        closingDate: status === SaleStatus.COMPLETED ? new Date() : sale.closingDate,
      },
      include: {
        property: true,
        realtor: { include: { user: { select: { firstName: true, lastName: true } } } },
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return updatedSale;
  }

  async deleteCancelledSale(id: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.CANCELLED) {
      throw new BadRequestException('Only cancelled sales can be deleted');
    }

    // Remove all child records before deleting the sale
    await this.prisma.payment.deleteMany({ where: { saleId: id } });
    await this.prisma.commission.deleteMany({ where: { saleId: id } });
    await this.prisma.tax.deleteMany({ where: { saleId: id } });
    await this.prisma.sale.delete({ where: { id } });

    return { success: true, message: 'Cancelled sale deleted' };
  }

  async getStats(period?: 'week' | 'month' | 'quarter' | 'year') {
    const now = new Date();
    let startDate: Date = new Date('2020-01-01T00:00:00Z'); // epoch fallback (all-time)

    if (period) {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter': {
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        }
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
    }

    // Sale counts still use saleDate (measures deals closed in the period)
    const dateFilter = period ? { gte: startDate } : undefined;
    const ACTIVE_STATUS = { in: [SaleStatus.COMPLETED, SaleStatus.IN_PROGRESS] };

    const [countFull, countInstall, pending, totalRevenue, totalCommission, totalTax] =
      await Promise.all([
        this.prisma.sale.count({
          where: { status: SaleStatus.COMPLETED, paymentPlan: 'FULL', ...(dateFilter ? { saleDate: dateFilter } : {}) },
        }),
        this.prisma.sale.count({
          where: { status: ACTIVE_STATUS, paymentPlan: 'INSTALLMENT', ...(dateFilter ? { saleDate: dateFilter } : {}) },
        }),
        this.prisma.sale.count({ where: { status: SaleStatus.PENDING } }),
        // Revenue, commission, tax from ledger (cash-basis, payment-date attributed)
        this.ledgerService.getRevenue(startDate, now),
        this.ledgerService.getCommissionTotal(startDate, now),
        this.ledgerService.getTaxTotal(startDate, now),
      ]);

    return {
      totalSales:       countFull + countInstall,
      pendingSales:     pending,
      totalRevenue,
      totalCommission,
      totalTax,
      totalNetEarnings: totalRevenue - totalCommission - totalTax,
    };
  }
}
