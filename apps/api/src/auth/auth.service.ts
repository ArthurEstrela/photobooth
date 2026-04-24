import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto, ChangePasswordDto } from '@packages/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.tenant.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const tenant = await this.prisma.tenant.create({
      data: { name: dto.name, email: dto.email, passwordHash },
    });

    return this.buildToken(tenant);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { email: dto.email },
    });
    if (!tenant) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, tenant.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.buildToken(tenant);
  }

  async changePassword(tenantId: string, dto: ChangePasswordDto): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    const valid = await bcrypt.compare(dto.currentPassword, tenant.passwordHash);
    if (!valid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('A nova senha deve ter pelo menos 8 caracteres');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { passwordHash },
    });
  }

  async adminLogin(email: string, password: string): Promise<{ token: string }> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminHash) {
      throw new UnauthorizedException('Admin not configured');
    }

    const emailMatch = email === adminEmail;
    const passwordMatch = await bcrypt.compare(password, adminHash);

    if (!emailMatch || !passwordMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const token = this.jwt.sign(
      { sub: 'admin', email: adminEmail, role: 'admin' },
      { expiresIn: '24h' },
    );
    return { token };
  }

  private buildToken(tenant: {
    id: string;
    email: string;
  }): AuthResponseDto {
    const payload = { sub: tenant.id, email: tenant.email };
    return {
      accessToken: this.jwt.sign(payload),
      tenantId: tenant.id,
      email: tenant.email,
    };
  }
}
