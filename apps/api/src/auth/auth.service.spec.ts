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
  sign: jest.fn(),
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
    mockJwt.sign.mockReturnValue('mock.jwt.token');
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
          data: expect.objectContaining({
            email: 'test@test.com',
            passwordHash: expect.not.stringMatching('senha123'),
          }),
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

    it('sets billingAnchorDay from signup date (capped at 28)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-1', email: 'test@test.com' });

      await service.register({ name: 'Test', email: 'test@test.com', password: '12345678' });

      const createCall = mockPrisma.tenant.create.mock.calls[0][0];
      expect(createCall.data.billingAnchorDay).toBeGreaterThanOrEqual(1);
      expect(createCall.data.billingAnchorDay).toBeLessThanOrEqual(28);
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
      expect(mockJwt.sign).toHaveBeenCalledWith({ sub: 'tenant-1', email: 'test@test.com' });
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

  describe('adminLogin', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@photobooth.com';
      process.env.ADMIN_PASSWORD_HASH = '$2b$10$22AWWXmhVQ8aSw5LP6K5uOJmPcsCm9oEOK82Hmejna1t5lOF4gmLm'; // bcrypt of 'secret123'
    });

    afterEach(() => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD_HASH;
    });

    it('throws UnauthorizedException when ADMIN_EMAIL is not set', async () => {
      delete process.env.ADMIN_EMAIL;
      await expect(service.adminLogin('admin@photobooth.com', 'secret123')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong email', async () => {
      await expect(service.adminLogin('wrong@email.com', 'secret123')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      await expect(service.adminLogin('admin@photobooth.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
    });

    it('returns token with role: admin on correct credentials', async () => {
      mockJwt.sign.mockReturnValue('admin.jwt.token');
      const result = await service.adminLogin('admin@photobooth.com', 'secret123');
      expect(result).toEqual({ token: 'admin.jwt.token' });
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
        expect.objectContaining({ expiresIn: '24h' }),
      );
    });
  });
});
