import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto } from '@packages/shared';
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
