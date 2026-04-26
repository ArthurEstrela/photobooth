import { Test, TestingModule } from '@nestjs/testing';
import { GeneratePairingCodeUseCase } from './generate-pairing-code.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe('GeneratePairingCodeUseCase', () => {
  let useCase: GeneratePairingCodeUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePairingCodeUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<GeneratePairingCodeUseCase>(GeneratePairingCodeUseCase);
    jest.clearAllMocks();
  });

  it('generates a 6-char code from unambiguous charset and saves to booth', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', tenantId: 'tenant-1' });
    mockPrisma.booth.update.mockResolvedValue({});

    const result = await useCase.execute('booth-1', 'tenant-1');

    expect(result.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(mockPrisma.booth.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booth-1' },
        data: expect.objectContaining({ pairingCode: result.code }),
      }),
    );
  });

  it('throws NotFoundException when booth does not belong to tenant', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('booth-999', 'tenant-1')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.booth.update).not.toHaveBeenCalled();
  });

  it('code contains no ambiguous characters (0, O, 1, I, L)', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', tenantId: 'tenant-1' });
    mockPrisma.booth.update.mockResolvedValue({});

    const codes = await Promise.all(
      Array.from({ length: 50 }, () => useCase.execute('booth-1', 'tenant-1')),
    );
    const allChars = codes.map((r) => r.code).join('');
    expect(allChars).not.toMatch(/[0OI1L]/);
  });
});
