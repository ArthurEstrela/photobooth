import { Test } from '@nestjs/testing';
import { EventController } from './event.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const TENANT_USER = { user: { tenantId: 'tenant-1', email: 't@t.com' } };

describe('EventController', () => {
  let controller: EventController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [EventController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(EventController);
  });

  it('POST /events creates event with digitalPrice and maxTemplates', async () => {
    const created = {
      id: 'ev-1', name: 'Wedding', price: 30, photoCount: 4,
      digitalPrice: 5, backgroundUrl: null, maxTemplates: 3,
      tenantId: 'tenant-1', createdAt: new Date(), updatedAt: new Date(),
    };
    mockPrisma.event.create.mockResolvedValue(created);

    const result = await controller.create(
      { name: 'Wedding', price: 30, photoCount: 4, digitalPrice: 5, backgroundUrl: null, maxTemplates: 3 },
      TENANT_USER as any,
    );

    expect(mockPrisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ digitalPrice: 5, maxTemplates: 3, tenantId: 'tenant-1' }),
    });
    expect(result.id).toBe('ev-1');
  });

  it('POST /events defaults digitalPrice to null and maxTemplates to 5', async () => {
    mockPrisma.event.create.mockResolvedValue({ id: 'ev-2' });

    await controller.create({ name: 'Party', price: 20 }, TENANT_USER as any);

    expect(mockPrisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ digitalPrice: null, maxTemplates: 5 }),
    });
  });

  it('PUT /events/:id updates digitalPrice and maxTemplates', async () => {
    mockPrisma.event.update.mockResolvedValue({ id: 'ev-1' });

    await controller.update('ev-1', { name: 'Updated', price: 25, maxTemplates: 4 });

    expect(mockPrisma.event.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data: expect.objectContaining({ maxTemplates: 4 }),
    });
  });
});
