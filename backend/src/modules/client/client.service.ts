import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, UserStatus, PropertyStatus, SaleStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DashboardPeriod, getDateRange } from '../../common/utils/date-range.util';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    realtorId?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, realtorId } = query;

    const where: any = {};

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (realtorId) {
      where.realtorId = realtorId;
    }

    const [clients, total] = await Promise.all([
      this.prisma.clientProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              status: true,
              createdAt: true,
            },
          },
          realtor: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              ownedProperties: true,
              purchases: true,
            },
          },
        },
      }),
      this.prisma.clientProfile.count({ where }),
    ]);

    return {
      data: clients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const client = await this.prisma.clientProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            status: true,
            createdAt: true,
          },
        },
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
        ownedProperties: true,
        purchases: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async findByUserId(userId: string) {
    const client = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            status: true,
          },
        },
        realtor: {
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
      },
    });

    if (!client) {
      throw new NotFoundException('Client profile not found');
    }

    return client;
  }

  async getDashboard(userId: string, period?: DashboardPeriod, month?: number, year?: number) {
    const client = await this.findByUserId(userId);

    const activePeriod: DashboardPeriod = period || 'monthly';
    const parsedMonth = month !== undefined && !isNaN(Number(month)) ? Number(month) : undefined;
    const parsedYear = year !== undefined && !isNaN(Number(year)) ? Number(year) : undefined;
    const { startDate, endDate } = getDateRange(activePeriod, parsedMonth, parsedYear);
    const dateFilter = { gte: startDate, lte: endDate };

    const [properties, purchases, filteredPurchases, pendingOffers] = await Promise.all([
      this.prisma.property.findMany({
        where: { ownerId: client.id },
        include: {
          priceHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.sale.findMany({
        where: {
          clientId: client.id,
          status: SaleStatus.COMPLETED,
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
        },
        orderBy: { saleDate: 'desc' },
      }),
      this.prisma.sale.findMany({
        where: {
          clientId: client.id,
          status: SaleStatus.COMPLETED,
          saleDate: dateFilter,
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
        },
        orderBy: { saleDate: 'desc' },
      }),
      this.prisma.offer.count({
        where: {
          property: { ownerId: client.id },
          status: 'PENDING',
        },
      }),
    ]);

    // Calculate property appreciation
    const propertiesWithAppreciation = properties.map((property) => {
      const appreciationPercentage =
        ((Number(property.price) - Number(property.originalPrice)) /
          Number(property.originalPrice)) *
        100;
      return {
        ...property,
        appreciationPercentage,
        appreciationValue: Number(property.price) - Number(property.originalPrice),
      };
    });

    const totalPropertyValue = properties.reduce(
      (sum, p) => sum + Number(p.price),
      0,
    );
    const totalOriginalValue = properties.reduce(
      (sum, p) => sum + Number(p.originalPrice),
      0,
    );
    const totalAppreciation = totalPropertyValue - totalOriginalValue;
    const avgAppreciationPercentage =
      totalOriginalValue > 0
        ? ((totalPropertyValue - totalOriginalValue) / totalOriginalValue) * 100
        : 0;

    const filteredSpent = filteredPurchases.reduce(
      (sum, p) => sum + Number(p.salePrice),
      0,
    );

    return {
      profile: client,
      stats: {
        totalProperties: properties.length,
        totalPropertyValue,
        totalPurchaseValue: client.totalPurchaseValue,
        totalAppreciation,
        avgAppreciationPercentage,
        pendingOffers,
        listedProperties: properties.filter((p) => p.isListed).length,
        filteredPurchases: filteredPurchases.length,
        filteredSpent,
      },
      properties: propertiesWithAppreciation,
      purchases,
      filteredPurchases,
      period: activePeriod,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  async createClient(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    realtorId: string;
  }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      // Check if they already have a client profile
      const existingProfile = await this.prisma.clientProfile.findUnique({
        where: { userId: existingUser.id },
      });

      if (existingProfile) {
        return existingProfile;
      }

      // Create client profile for existing user
      return this.prisma.clientProfile.create({
        data: {
          userId: existingUser.id,
          realtorId: data.realtorId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }

    // Create new user and client profile
    const temporaryPassword = uuidv4().substring(0, 12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        clientProfile: {
          create: {
            realtorId: data.realtorId,
          },
        },
      },
      include: {
        clientProfile: true,
      },
    });

    // Auto-subscribe new client to newsletter
    try {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined;
      await this.prisma.newsletterSubscriber.upsert({
        where: { email: user.email },
        update: { isActive: true, name: fullName },
        create: { email: user.email, name: fullName },
      });
    } catch {
      // Don't fail if newsletter subscribe fails
    }

    return {
      ...user.clientProfile,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      temporaryPassword,
    };
  }

  async getProperties(clientId: string, query: { page?: number; limit?: number; isListed?: boolean }) {
    const { page = 1, limit = 20, isListed } = query;
    const skip = (page - 1) * limit;

    const where: any = { ownerId: clientId };

    if (isListed !== undefined) {
      where.isListed = isListed;
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          documents: true,
          offers: {
            where: { status: 'PENDING' },
          },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listPropertyForSale(clientId: string, propertyId: string, listingPrice: number) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: clientId,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or not owned by client');
    }

    if (property.isListed) {
      throw new BadRequestException('Property is already listed');
    }

    return this.prisma.property.update({
      where: { id: propertyId },
      data: {
        isListed: true,
        listingPrice,
        listedAt: new Date(),
        status: PropertyStatus.LISTED,
      },
    });
  }

  async removePropertyListing(clientId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: clientId,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or not owned by client');
    }

    return this.prisma.property.update({
      where: { id: propertyId },
      data: {
        isListed: false,
        listingPrice: null,
        status: PropertyStatus.OFF_MARKET,
      },
    });
  }

  async getOffers(clientId: string, query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      property: { ownerId: clientId },
    };

    if (status) {
      where.status = status;
    }

    const [offers, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              title: true,
              address: true,
              price: true,
            },
          },
          buyer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.offer.count({ where }),
    ]);

    return {
      data: offers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async respondToOffer(
    clientId: string,
    offerId: string,
    response: 'accept' | 'reject' | 'counter',
    counterAmount?: number,
  ) {
    const offer = await this.prisma.offer.findFirst({
      where: {
        id: offerId,
        property: { ownerId: clientId },
        status: 'PENDING',
      },
      include: {
        property: true,
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found or not eligible for response');
    }

    let updateData: any = {
      respondedAt: new Date(),
    };

    switch (response) {
      case 'accept':
        updateData.status = 'ACCEPTED';
        // Update property status
        await this.prisma.property.update({
          where: { id: offer.propertyId },
          data: { status: PropertyStatus.UNDER_CONTRACT },
        });
        break;
      case 'reject':
        updateData.status = 'REJECTED';
        break;
      case 'counter':
        if (!counterAmount) {
          throw new BadRequestException('Counter amount is required');
        }
        updateData.status = 'COUNTERED';
        updateData.counterAmount = counterAmount;
        break;
    }

    return this.prisma.offer.update({
      where: { id: offerId },
      data: updateData,
    });
  }
}
