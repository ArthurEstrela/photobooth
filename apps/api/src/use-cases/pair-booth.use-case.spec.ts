import { Test, TestingModule } from '@nestjs/testing';
import { PairBoothUseCase } from './pair-booth.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn() };

const BOOTH = { id: 'booth-1', tenantId: 'tenant-1', pairingCodeExpiresAt: new Date(Date.now() + 60000) };

describe('PairBoothUseCase', () => {
  let useCase: PairBoothUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PairBoothUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    useCase = module.get<PairBoothUseCase>(PairBoothUseCase);
    jest.clearAllMocks();
  });

  it('returns boothId and signed JWT on valid code', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(BOOTH);
    mockPrisma.booth.update.mockResolvedValue({});
    mockJwt.sign.mockReturnValue('signed-jwt');

    const result = await useCase.execute('AB3K7X');

    expect(result).toEqual({ boothId: 'booth-1', token: 'signed-jwt' });
    expect(mockJwt.sign).toHaveBeenCalledWith(
      { sub: 'booth-1', tenantId: 'tenant-1', role: 'booth' },
      { expiresIn: '3650d' },
    );
  });

  it('clears pairingCode and sets pairedAt on success', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(BOOTH);
    mockPrisma.booth.update.mockResolvedValue({});
    mockJwt.sign.mockReturnValue('signed-jwt');

    await useCase.execute('AB3K7X');

    expect(mockPrisma.booth.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booth-1' },
        data: expect.objectContaining({
          pairingCode: null,
          pairingCodeExpiresAt: null,
          pairedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('throws NotFoundException when code is invalid or expired', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('BADCOD')).rejects.toThrow(NotFoundException);
    expect(mockJwt.sign).not.toHaveBeenCalled();
  });
});
