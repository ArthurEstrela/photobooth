import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('deve criar tenant e retornar token', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        email: 'test@test.com',
      });

      const result = await service.register({
        name: 'Empresa Teste',
        email: 'test@test.com',
        password: 'senha123',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.email).toBe('test@test.com');
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@test.com' }),
        }),
      );
    });

    it('deve lançar ConflictException se email já existe', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: 'pass' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('deve retornar token para credenciais válidas', async () => {
      const hash = await bcrypt.hash('senha123', 10);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        email: 'test@test.com',
        passwordHash: hash,
      });

      const result = await service.login({
        email: 'test@test.com',
        password: 'senha123',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('deve lançar UnauthorizedException para senha errada', async () => {
      const hash = await bcrypt.hash('correta', 10);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        email: 'test@test.com',
        passwordHash: hash,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException para email desconhecido', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
