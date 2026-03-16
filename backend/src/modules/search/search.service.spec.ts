import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../database/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: jest.Mocked<PrismaService>;

  const mockProperty = { id: '1', title: 'Test Villa', city: 'Lagos', state: 'Lagos', price: 500000, type: 'HOUSE', status: 'AVAILABLE', images: [], isListed: true };
  const mockUser = { id: 'u1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', phone: null, role: 'CLIENT', status: 'ACTIVE', avatar: null };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: PrismaService,
          useValue: {
            property: { findMany: jest.fn().mockResolvedValue([mockProperty]) },
            user: { findMany: jest.fn().mockResolvedValue([mockUser]) },
            clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
            realtorProfile: { findMany: jest.fn().mockResolvedValue([]) },
            staffProfile: { findMany: jest.fn().mockResolvedValue([]) },
            sale: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty results for short queries', async () => {
    const result = await service.globalSearch('a');
    expect(result.total).toBe(0);
  });

  it('should search across properties and users', async () => {
    const result = await service.globalSearch('test', 10, 'ADMIN');
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].title).toBe('Test Villa');
  });

  it('should not return users for CLIENT role', async () => {
    const result = await service.globalSearch('john', 10, 'CLIENT');
    expect(result.users).toHaveLength(0);
  });

  it('should cap limit at 25', async () => {
    await service.globalSearch('test', 100, 'ADMIN');
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });
});
