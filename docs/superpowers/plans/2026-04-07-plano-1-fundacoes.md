# Plano 1: Fundações — packages/shared, Auth, Schema, BoothGateway

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer as fundações do sistema: contrato de tipos compartilhados, autenticação real (JWT) na API e no dashboard, migrations do schema com os novos campos, e verificação real de token no WebSocket gateway.

**Architecture:** O `packages/shared` se torna o contrato central com enums, DTOs e interfaces. A API ganha um módulo de auth com JWT e os controllers existentes passam a usar o JwtAuthGuard. O dashboard ganha AuthContext com login/register e rotas protegidas. O BoothGateway passa a verificar o token no banco de dados.

**Tech Stack:** NestJS + Prisma + JWT (`@nestjs/jwt`) + bcrypt, React + Axios interceptors, Turborepo, TypeScript strict

---

## Mapa de Arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `packages/shared/package.json` |
| Modificar | `packages/shared/src/types.ts` |
| Criar | `turbo.json` |
| Criar | `apps/api/tsconfig.json` |
| Criar | `apps/totem/tsconfig.json` |
| Criar | `apps/dashboard/tsconfig.json` |
| Modificar | `apps/api/prisma/schema.prisma` |
| Modificar | `apps/api/package.json` |
| Criar | `apps/api/src/auth/auth.service.ts` |
| Criar | `apps/api/src/auth/auth.service.spec.ts` |
| Criar | `apps/api/src/auth/jwt.strategy.ts` |
| Criar | `apps/api/src/auth/jwt-auth.guard.ts` |
| Criar | `apps/api/src/auth/auth.controller.ts` |
| Criar | `apps/api/src/auth/auth.module.ts` |
| Modificar | `apps/api/src/auth/tenant.guard.ts` |
| Modificar | `apps/api/src/app.module.ts` |
| Modificar | `apps/api/src/gateways/booth.gateway.ts` |
| Criar | `apps/api/src/gateways/booth.gateway.spec.ts` |
| Modificar | `apps/dashboard/src/lib/api.ts` |
| Criar | `apps/dashboard/src/context/AuthContext.tsx` |
| Criar | `apps/dashboard/src/components/ProtectedRoute.tsx` |
| Criar | `apps/dashboard/src/pages/LoginPage.tsx` |
| Criar | `apps/dashboard/src/pages/RegisterPage.tsx` |
| Modificar | `apps/dashboard/src/App.tsx` |

---

## Task 1: packages/shared — Reestruturar e Expandir Contratos

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Atualizar `packages/shared/package.json`**

Renomear de `@photobooth/shared` para `@packages/shared` (corrige mismatch com os imports existentes):

```json
{
  "name": "@packages/shared",
  "version": "1.0.0",
  "private": true,
  "main": "src/types.ts",
  "types": "src/types.ts"
}
```

- [ ] **Step 2: Expandir `packages/shared/src/types.ts`**

Substituir o conteúdo completo pelo arquivo expandido com todos os contratos:

```typescript
// packages/shared/src/types.ts

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum BoothState {
  IDLE = 'IDLE',
  SELECTING_TEMPLATE = 'SELECTING_TEMPLATE',
  WAITING_PAYMENT = 'WAITING_PAYMENT',
  IN_SESSION = 'IN_SESSION',
  COUNTDOWN = 'COUNTDOWN',
  CAPTURING = 'CAPTURING',
  PROCESSING = 'PROCESSING',
  DELIVERY = 'DELIVERY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum OfflineMode {
  BLOCK = 'BLOCK',
  DEMO = 'DEMO',
  CREDITS = 'CREDITS',
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export interface PaymentApprovedEvent {
  paymentId: string;
  boothId: string;
  sessionId: string;
}

export interface PaymentExpiredEvent {
  paymentId: string;
  boothId: string;
}

export interface BoothStateUpdate {
  boothId: string;
  state: BoothState;
}

export interface PhotoSyncedEvent {
  sessionId: string;
  photoUrl: string;
  tenantId: string;
}

// ─── DTOs (Request/Response) ──────────────────────────────────────────────────

export interface CreatePixPaymentDTO {
  boothId: string;
  eventId: string;
  templateId?: string;
  amount: number;
}

export interface PixPaymentResponse {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresIn: number;
}

export interface SyncPhotoDto {
  sessionId: string;
  photoBase64: string;
}

export interface PhotoSessionDTO {
  eventId: string;
  boothId: string;
  paymentId: string;
  photoUrls: string[];
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  tenantId: string;
  email: string;
}

export interface BoothBranding {
  logoUrl: string | null;
  primaryColor: string | null;
  brandName: string | null;
}

export interface BoothConfigDto {
  offlineMode: OfflineMode;
  offlineCredits: number;
  demoSessionsPerHour: number;
  cameraSound: boolean;
  branding: BoothBranding;
}

// ─── Domain Interfaces ────────────────────────────────────────────────────────

export interface ITenant {
  id: string;
  name: string;
  email: string;
  logoUrl: string | null;
  primaryColor: string | null;
  brandName: string | null;
  planId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBooth {
  id: string;
  name: string;
  token: string;
  tenantId: string;
  offlineMode: OfflineMode;
  offlineCredits: number;
  demoSessionsPerHour: number;
  cameraSound: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvent {
  id: string;
  name: string;
  price: number;
  photoCount: 1 | 2 | 4;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemplate {
  id: string;
  name: string;
  overlayUrl: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  id: string;
  externalId: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  amount: number;
  status: PaymentStatus;
  boothId: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPhotoSession {
  id: string;
  paymentId: string;
  boothId: string;
  eventId: string;
  photoUrls: string[];
  createdAt: Date;
}

export interface IPlan {
  id: string;
  name: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  maxBooths: number;
  maxSessionsPerMonth: number;
}

export interface TenantMetrics {
  totalRevenue: number;
  totalSessions: number;
  conversionRate: number;
  activeBooths: number;
}

export interface Event {
  id: string;
  name: string;
  price: number;
  photoCount: number;
  overlayUrl?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): expand contracts with auth DTOs, new enums, domain interfaces"
```

---

## Task 2: turbo.json + tsconfig para todos os apps

**Files:**
- Create: `turbo.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/totem/tsconfig.json`
- Create: `apps/dashboard/tsconfig.json`

- [ ] **Step 1: Criar `turbo.json` na raiz**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 2: Criar `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2020",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "paths": {
      "@packages/shared": ["../../packages/shared/src/types.ts"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Criar `apps/totem/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@packages/shared": ["../../packages/shared/src/types.ts"]
    }
  },
  "include": ["src/**/*", "electron/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Criar `apps/dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@packages/shared": ["../../packages/shared/src/types.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Verificar que o Vite resolve o path alias**

O `vite.config.ts` do dashboard precisa do plugin `vite-tsconfig-paths` ou alias manual. Abrir `apps/dashboard/vite.config.ts` e adicionar o alias:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@packages/shared': path.resolve(__dirname, '../../packages/shared/src/types.ts'),
    },
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add turbo.json apps/api/tsconfig.json apps/totem/tsconfig.json apps/dashboard/tsconfig.json apps/dashboard/vite.config.ts
git commit -m "chore: add turbo.json and tsconfig for all apps with @packages/shared path alias"
```

---

## Task 3: Schema Prisma — Migrations

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Atualizar `apps/api/prisma/schema.prisma`**

Substituir o conteúdo completo pelo schema expandido:

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Plan {
  id                  String   @id @default(uuid())
  name                String   // FREE, STARTER, PRO, ENTERPRISE
  maxBooths           Int
  maxSessionsPerMonth Int
  tenants             Tenant[]
  createdAt           DateTime @default(now())
}

model Tenant {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  logoUrl      String?
  primaryColor String?
  brandName    String?
  planId       String?
  plan         Plan?    @relation(fields: [planId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  booths       Booth[]
  events       Event[]
}

model Booth {
  id                 String   @id @default(uuid())
  name               String
  token              String   @unique
  tenantId           String
  tenant             Tenant   @relation(fields: [tenantId], references: [id])
  offlineMode        String   @default("BLOCK")
  offlineCredits     Int      @default(0)
  demoSessionsPerHour Int     @default(3)
  cameraSound        Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  payments           Payment[]
  photoSessions      PhotoSession[]
}

model Event {
  id            String     @id @default(uuid())
  name          String
  price         Decimal
  photoCount    Int        @default(1)
  tenantId      String
  tenant        Tenant     @relation(fields: [tenantId], references: [id])
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  templates     Template[]
  payments      Payment[]
  photoSessions PhotoSession[]
}

model Template {
  id         String   @id @default(uuid())
  name       String
  overlayUrl String
  eventId    String
  event      Event    @relation(fields: [eventId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Payment {
  id           String        @id @default(uuid())
  externalId   String?       @unique
  qrCode       String?
  qrCodeBase64 String?
  amount       Decimal
  status       String        @default("PENDING")
  boothId      String
  booth        Booth         @relation(fields: [boothId], references: [id])
  eventId      String
  event        Event         @relation(fields: [eventId], references: [id])
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  photoSession PhotoSession?
}

model PhotoSession {
  id        String   @id @default(uuid())
  paymentId String   @unique
  payment   Payment  @relation(fields: [paymentId], references: [id])
  boothId   String
  booth     Booth    @relation(fields: [boothId], references: [id])
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id])
  photoUrls String[]
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Rodar a migration**

```bash
cd apps/api
npx prisma migrate dev --name add-plan-auth-offline-fields
```

Saída esperada: `The following migration(s) have been created and applied...`

- [ ] **Step 3: Gerar o Prisma Client atualizado**

```bash
npx prisma generate
```

Saída esperada: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): schema migration — Plan model, auth fields, offline config, photoCount"
```

---

## Task 4: API — Instalar Dependências e Configurar Jest

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar dependências faltantes**

```bash
cd apps/api
npm install @nestjs/jwt @nestjs/passport @nestjs/config @nestjs/websockets @nestjs/platform-socket.io @nestjs/bull bull socket.io bcrypt passport passport-jwt
npm install -D @types/bcrypt @types/passport-jwt @nestjs/testing jest ts-jest @types/jest
```

- [ ] **Step 2: Adicionar scripts de test e config do Jest no `apps/api/package.json`**

O arquivo completo após a edição deve conter:

```json
{
  "name": "api",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@nestjs/bull": "^10.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@prisma/client": "^5.0.0",
    "axios": "^1.6.0",
    "bcrypt": "^5.1.0",
    "bull": "^4.12.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "socket.io": "^4.6.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/jest": "^29.0.0",
    "@types/passport-jwt": "^4.0.0",
    "jest": "^29.0.0",
    "prisma": "^5.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "moduleNameMapper": {
      "@packages/shared": "<rootDir>/../../packages/shared/src/types.ts"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 3: Verificar instalação**

```bash
cd apps/api && npm install
```

Saída esperada: sem erros de peer dependency críticos.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json
git commit -m "chore(api): add auth, websocket, bull, jest dependencies"
```

---

## Task 5: API — AuthService (TDD)

**Files:**
- Create: `apps/api/src/auth/auth.service.spec.ts`
- Create: `apps/api/src/auth/auth.service.ts`

- [ ] **Step 1: Escrever os testes primeiro**

Criar `apps/api/src/auth/auth.service.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Rodar o teste — verificar que FALHA (AuthService não existe)**

```bash
cd apps/api && npx jest src/auth/auth.service.spec.ts --no-coverage
```

Saída esperada: `FAIL` com `Cannot find module './auth.service'`

- [ ] **Step 3: Implementar `apps/api/src/auth/auth.service.ts`**

```typescript
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
```

- [ ] **Step 4: Rodar o teste — verificar que PASSA**

```bash
cd apps/api && npx jest src/auth/auth.service.spec.ts --no-coverage
```

Saída esperada: `PASS src/auth/auth.service.spec.ts` com 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService with register/login and JWT — TDD"
```

---

## Task 6: API — JWT Strategy e Guard

**Files:**
- Create: `apps/api/src/auth/jwt.strategy.ts`
- Create: `apps/api/src/auth/jwt-auth.guard.ts`

- [ ] **Step 1: Criar `apps/api/src/auth/jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface RequestUser {
  tenantId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    return { tenantId: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 2: Criar `apps/api/src/auth/jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/jwt.strategy.ts apps/api/src/auth/jwt-auth.guard.ts
git commit -m "feat(api): JWT strategy and guard"
```

---

## Task 7: API — AuthController e AuthModule

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Criar `apps/api/src/auth/auth.controller.ts`**

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from '@packages/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

- [ ] **Step 2: Criar `apps/api/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [JwtModule],
})
export class AuthModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.module.ts
git commit -m "feat(api): AuthController (POST /auth/login, /auth/register) and AuthModule"
```

---

## Task 8: API — Atualizar AppModule e TenantGuard

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/auth/tenant.guard.ts`

- [ ] **Step 1: Atualizar `apps/api/src/app.module.ts`**

Adicionar `AuthModule` nos imports:

```typescript
// apps/api/src/app.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { BoothGateway } from './gateways/booth.gateway';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter';
import { CreatePixPaymentUseCase } from './use-cases/create-pix-payment.use-case';
import { ProcessWebhookUseCase } from './use-cases/process-webhook.use-case';
import { PaymentExpirationProcessor } from './workers/payment-expiration.processor';
import { PaymentController } from './controllers/payment.controller';
import { S3StorageAdapter } from './adapters/storage/s3.adapter';
import { SyncPhotoUseCase } from './use-cases/sync-photo.use-case';
import { PhotoController } from './controllers/photo.controller';
import { TenantController } from './controllers/tenant.controller';
import { EventController } from './controllers/event.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'payment-expiration',
    }),
  ],
  controllers: [PaymentController, PhotoController, TenantController, EventController],
  providers: [
    PrismaService,
    BoothGateway,
    MercadoPagoAdapter,
    CreatePixPaymentUseCase,
    ProcessWebhookUseCase,
    PaymentExpirationProcessor,
    S3StorageAdapter,
    SyncPhotoUseCase,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Refatorar `apps/api/src/auth/tenant.guard.ts`**

Substituir o guard que usa header fraco pelo JwtAuthGuard real:

```typescript
// apps/api/src/auth/tenant.guard.ts
//
// Este guard foi substituído pelo JwtAuthGuard para produção.
// Mantido aqui apenas como referência. Use JwtAuthGuard nos controllers.

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * @deprecated Use JwtAuthGuard instead.
 * Kept for backward compatibility during migration.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; query: Record<string, string>; body: Record<string, string>; tenantId?: string }>();
    const tenantId =
      request.headers['x-tenant-id'] ??
      request.query['tenantId'] ??
      request.body['tenantId'];

    if (!tenantId) {
      throw new UnauthorizedException('Tenant identification is missing');
    }

    request.tenantId = tenantId;
    return true;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/auth/tenant.guard.ts
git commit -m "feat(api): wire AuthModule into AppModule, deprecate TenantGuard"
```

---

## Task 9: API — BoothGateway com Verificação Real de Token (TDD)

**Files:**
- Create: `apps/api/src/gateways/booth.gateway.spec.ts`
- Modify: `apps/api/src/gateways/booth.gateway.ts`

- [ ] **Step 1: Escrever os testes**

Criar `apps/api/src/gateways/booth.gateway.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BoothGateway } from './booth.gateway';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
  },
};

function makeClient(boothId: string, token: string, socketId = 'socket-abc') {
  return {
    id: socketId,
    handshake: {
      query: { boothId },
      headers: { authorization: `Bearer ${token}` },
    },
    disconnect: jest.fn(),
  };
}

describe('BoothGateway', () => {
  let gateway: BoothGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoothGateway,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    gateway = module.get<BoothGateway>(BoothGateway);
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('deve registrar cabine com token válido', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'valid-token' });
      const client = makeClient('booth-1', 'valid-token');

      await gateway.handleConnection(client as any);

      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('deve desconectar cabine com token inválido', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue(null);
      const client = makeClient('booth-1', 'bad-token');

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('deve desconectar se boothId estiver ausente', async () => {
      const client = makeClient('', 'some-token');

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('deve desconectar se Authorization header estiver ausente', async () => {
      const client = {
        id: 'socket-1',
        handshake: { query: { boothId: 'booth-1' }, headers: {} },
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('deve remover cabine do mapa ao desconectar', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'valid-token' });
      const client = makeClient('booth-1', 'valid-token', 'socket-xyz');

      await gateway.handleConnection(client as any);
      gateway.handleDisconnect(client as any);

      // sendPaymentApproved não deve encontrar o socket após desconexão
      // (verifica indiretamente que o mapa foi limpo)
      const serverMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      (gateway as any).server = serverMock;
      gateway.sendPaymentApproved('booth-1', {});
      expect(serverMock.to).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar o teste — verificar que FALHA (gateway não injeta PrismaService)**

```bash
cd apps/api && npx jest src/gateways/booth.gateway.spec.ts --no-coverage
```

Saída esperada: `FAIL` — o gateway atual não injeta `PrismaService`.

- [ ] **Step 3: Atualizar `apps/api/src/gateways/booth.gateway.ts`**

```typescript
// apps/api/src/gateways/booth.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothStateUpdate } from '@packages/shared';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'booth' })
export class BoothGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BoothGateway.name);
  private connectedBooths = new Map<string, string>(); // boothId → socketId

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const boothId = client.handshake.query['boothId'] as string;
    const authHeader = client.handshake.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');

    if (!boothId || !token) {
      client.disconnect();
      return;
    }

    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, token },
    });

    if (!booth) {
      this.logger.warn(`Connection rejected for booth ${boothId} — invalid token`);
      client.disconnect();
      return;
    }

    this.connectedBooths.set(boothId, client.id);
    this.logger.log(`Booth connected: ${boothId}`);
  }

  handleDisconnect(client: Socket) {
    const boothId = Array.from(this.connectedBooths.entries()).find(
      ([, id]) => id === client.id,
    )?.[0];

    if (boothId) {
      this.connectedBooths.delete(boothId);
      this.logger.log(`Booth disconnected: ${boothId}`);
    }
  }

  @SubscribeMessage('update_state')
  handleStateUpdate(
    @MessageBody() data: BoothStateUpdate,
    @ConnectedSocket() _client: Socket,
  ) {
    this.logger.log(`Booth ${data.boothId} → state: ${data.state}`);
  }

  sendPaymentApproved(boothId: string, payload: unknown) {
    const socketId = this.connectedBooths.get(boothId);
    if (socketId) {
      this.server.to(socketId).emit('payment_approved', payload);
    }
  }

  sendPaymentExpired(boothId: string) {
    const socketId = this.connectedBooths.get(boothId);
    if (socketId) {
      this.server.to(socketId).emit('payment_expired');
    }
  }
}
```

- [ ] **Step 4: Adicionar `PrismaService` como provider no `AppModule`** (já está, confirmar)

Verificar que `PrismaService` está na lista de `providers` em `app.module.ts`. Se não estiver, adicionar.

- [ ] **Step 5: Rodar o teste — verificar que PASSA**

```bash
cd apps/api && npx jest src/gateways/booth.gateway.spec.ts --no-coverage
```

Saída esperada: `PASS src/gateways/booth.gateway.spec.ts` com todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/gateways/booth.gateway.ts apps/api/src/gateways/booth.gateway.spec.ts
git commit -m "feat(api): BoothGateway — real token verification via Prisma + NestJS Logger — TDD"
```

---

## Task 10: Dashboard — Atualizar api.ts com Auth Interceptors

**Files:**
- Modify: `apps/dashboard/src/lib/api.ts`

- [ ] **Step 1: Substituir `apps/dashboard/src/lib/api.ts`**

```typescript
// apps/dashboard/src/lib/api.ts

import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

// Injetar token JWT em todas as requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirecionar para /login em 401
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      window.location.pathname !== '/login'
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('tenantId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/lib/api.ts
git commit -m "feat(dashboard): api.ts — JWT interceptor and 401 redirect"
```

---

## Task 11: Dashboard — AuthContext

**Files:**
- Create: `apps/dashboard/src/context/AuthContext.tsx`

- [ ] **Step 1: Criar `apps/dashboard/src/context/AuthContext.tsx`**

```typescript
import React, { createContext, useContext, useState } from 'react';
import { AuthResponseDto, LoginDto, RegisterDto } from '@packages/shared';
import { api } from '../lib/api';
import axios from 'axios';

interface AuthContextValue {
  token: string | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token'),
  );
  const [tenantId, setTenantId] = useState<string | null>(
    () => localStorage.getItem('tenantId'),
  );

  const persist = (data: AuthResponseDto) => {
    setToken(data.accessToken);
    setTenantId(data.tenantId);
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('tenantId', data.tenantId);
  };

  const login = async (dto: LoginDto) => {
    const res = await api.post<AuthResponseDto>('/auth/login', dto);
    persist(res.data);
  };

  const register = async (dto: RegisterDto) => {
    const res = await api.post<AuthResponseDto>('/auth/register', dto);
    persist(res.data);
  };

  const logout = () => {
    setToken(null);
    setTenantId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
  };

  return (
    <AuthContext.Provider
      value={{ token, tenantId, isAuthenticated: !!token, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/context/AuthContext.tsx
git commit -m "feat(dashboard): AuthContext with login/register/logout"
```

---

## Task 12: Dashboard — ProtectedRoute

**Files:**
- Create: `apps/dashboard/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Criar `apps/dashboard/src/components/ProtectedRoute.tsx`**

```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/ProtectedRoute.tsx
git commit -m "feat(dashboard): ProtectedRoute — redirect to /login if unauthenticated"
```

---

## Task 13: Dashboard — LoginPage

**Files:**
- Create: `apps/dashboard/src/pages/LoginPage.tsx`

- [ ] **Step 1: Criar `apps/dashboard/src/pages/LoginPage.tsx`**

```typescript
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Email ou senha inválidos');
      } else {
        setError('Erro ao conectar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
          <p className="text-gray-500 text-sm mt-1">Acesse seu painel PhotoBooth</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Não tem conta?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/LoginPage.tsx
git commit -m "feat(dashboard): LoginPage"
```

---

## Task 14: Dashboard — RegisterPage

**Files:**
- Create: `apps/dashboard/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Criar `apps/dashboard/src/pages/RegisterPage.tsx`**

```typescript
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ name, email, password });
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        setError(
          msg === 'Email já cadastrado'
            ? 'Este email já está em uso'
            : 'Erro ao criar conta. Tente novamente.',
        );
      } else {
        setError('Erro ao conectar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Criar conta</h1>
          <p className="text-gray-500 text-sm mt-1">
            Comece a usar o PhotoBooth SaaS gratuitamente
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da empresa
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Fotografia Silva"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Criando conta...' : 'Criar conta grátis'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/RegisterPage.tsx
git commit -m "feat(dashboard): RegisterPage"
```

---

## Task 15: Dashboard — App.tsx com AuthProvider e Rotas Protegidas

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

- [ ] **Step 1: Substituir `apps/dashboard/src/App.tsx`**

```typescript
// apps/dashboard/src/App.tsx

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/DashboardLayout';
import { Home } from './pages/Home';
import { EventsPage } from './pages/EventsPage';
import { GuestPhoto } from './pages/GuestPhoto';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useDashboardSocket } from './hooks/useDashboardSocket';

const queryClient = new QueryClient();

// Inicializa WebSocket apenas dentro do AuthProvider
function DashboardSocketInit() {
  const { tenantId } = useAuth();
  useDashboardSocket(tenantId ?? '');
  return null;
}

function AppContent() {
  const location = useLocation();
  const isPublic =
    location.pathname.startsWith('/p/') ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  if (isPublic) {
    return (
      <Routes>
        <Route path="/p/:sessionId" element={<GuestPhoto />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardSocketInit />
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/gallery" element={<div className="p-8 text-gray-500">Galeria em breve...</div>} />
          <Route path="/booths" element={<div className="p-8 text-gray-500">Cabines em breve...</div>} />
        </Routes>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 2: Rodar o dashboard em dev para verificar**

```bash
cd apps/dashboard && npm run dev
```

Verificar:
- `/login` exibe a página de login
- `/register` exibe a página de cadastro
- `/` sem token redireciona para `/login`
- Após login bem-sucedido, redireciona para `/`

- [ ] **Step 3: Commit final do Plano 1**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat(dashboard): wire AuthProvider, ProtectedRoute, /login and /register routes"
```

---

## Verificação Final do Plano 1

Após todas as tasks, rodar:

```bash
# Testes da API
cd apps/api && npx jest --no-coverage

# Typecheck do dashboard
cd apps/dashboard && npx tsc --noEmit

# Typecheck da API
cd apps/api && npx tsc --noEmit
```

Saída esperada:
- `PASS src/auth/auth.service.spec.ts` — 5 testes
- `PASS src/gateways/booth.gateway.spec.ts` — 4 testes
- Dashboard: sem erros de tipo
- API: sem erros de tipo

---

## Pré-requisito para Planos 2 e 3

Com o Plano 1 concluído, os Planos 2 (Totem Premium) e 3 (Dashboard Full SaaS) podem ser executados em **paralelo**, pois não compartilham arquivos entre si.
