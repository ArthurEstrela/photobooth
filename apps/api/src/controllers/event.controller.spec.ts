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

const USER = { user: { tenantId: 'tenant-1', email: 't@t.com' } };

describe('EventController (JWT)', () => {
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

  it('findAll uses tenantId from JWT', async () => {
    mockPrisma.event.findMany.mockResolvedValueOnce([{ id: 'e-1', name: 'Wedding' }]);

    const result = await controller.findAll(USER as any);

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('create uses tenantId from JWT', async () => {
    mockPrisma.event.create.mockResolvedValueOnce({ id: 'e-new' });

    await controller.create({ name: 'Party', price: 20 }, USER as any);

    expect(mockPrisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
  });
});
