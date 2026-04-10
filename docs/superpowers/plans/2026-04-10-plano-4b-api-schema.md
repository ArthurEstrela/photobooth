# Plano 4B — API + Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update schema for template pools, event-template ordering, booth active event, and add analytics/digital-upsell/logo-upload endpoints.

**Architecture:** Template now belongs to Tenant (pool), not Event. `EventTemplate` join table links templates to events with explicit ordering. Booth gains `activeEventId` FK. New analytics endpoint aggregates revenue + sessions by day. Digital upsell endpoint creates a second PIX for a completed photo session.

**Tech Stack:** NestJS, Prisma, PostgreSQL, AWS S3, @nestjs/platform-express (multer)

---

## File Map

**Modified:**
- `packages/shared/src/types.ts` — update ITemplate (tenantId), IEvent (new fields), IBooth (activeEventId), BoothEventResponseDto, IPaymentRecord (paymentType); add IEventTemplate, IAnalyticsDayEntry, IAnalyticsData
- `apps/api/prisma/schema.prisma` — Template→Tenant, EventTemplate join table, Event new fields, Booth.activeEventId, Payment.paymentType
- `apps/api/src/adapters/storage/s3.adapter.ts` — add generic `uploadFile(folder, buffer, mimeType)` method
- `apps/api/src/controllers/tenant.controller.ts` — inject S3, add template CRUD + event-template assignment + booth event setter + analytics + logo upload endpoints; fix `getPayments` to include `paymentType`
- `apps/api/src/controllers/event.controller.ts` — handle digitalPrice, backgroundUrl, maxTemplates
- `apps/api/src/controllers/booths.controller.ts` — use activeEventId, updated BoothEventResponseDto
- `apps/api/src/controllers/payment.controller.ts` — add GET /:id + POST /digital/:sessionId
- `apps/api/src/app.module.ts` — register CreateDigitalPaymentUseCase
- `apps/api/src/controllers/tenant.controller.spec.ts` — add tests for template, analytics endpoints
- `apps/api/src/controllers/booths.controller.spec.ts` — update getBoothEvent tests

**New:**
- `apps/api/src/use-cases/create-digital-payment.use-case.ts`
- `apps/api/prisma/migrations/<timestamp>_template_event_redesign/` (auto-generated)

---

## Task 1: Update shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Replace `packages/shared/src/types.ts`**

```ts
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
  activeEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvent {
  id: string;
  name: string;
  price: number;
  photoCount: 1 | 2 | 4;
  digitalPrice: number | null;
  backgroundUrl: string | null;
  maxTemplates: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemplate {
  id: string;
  name: string;
  overlayUrl: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventTemplate {
  eventId: string;
  templateId: string;
  order: number;
  template: ITemplate;
}

export interface IPayment {
  id: string;
  externalId: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  amount: number;
  status: PaymentStatus;
  paymentType: 'MAIN' | 'DIGITAL';
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

export interface BoothEventResponseDto {
  event: {
    id: string;
    name: string;
    price: number;
    photoCount: 1 | 2 | 4;
    digitalPrice: number | null;
    backgroundUrl: string | null;
    maxTemplates: number;
  };
  templates: Array<{ id: string; name: string; overlayUrl: string; order: number }>;
}

// ─── Dashboard DTOs & Models ─────────────────────────────────────────────────

export interface IBoothWithStatus extends IBooth {
  isOnline: boolean;
  activeEvent?: { id: string; name: string } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IPaymentRecord {
  id: string;
  amount: number;
  status: PaymentStatus;
  eventName: string;
  boothName: string;
  paymentType: 'MAIN' | 'DIGITAL';
  createdAt: Date;
}

export interface IGallerySession {
  sessionId: string;
  photoUrls: string[];
  eventName: string;
  boothName: string;
  createdAt: Date;
}

export interface UpdateTenantSettingsDto {
  logoUrl?: string | null;
  primaryColor?: string | null;
  brandName?: string | null;
}

export interface ITenantSettings {
  logoUrl: string | null;
  primaryColor: string | null;
  brandName: string | null;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface IAnalyticsDayEntry {
  date: string; // YYYY-MM-DD
  revenue: number;
  sessions: number;
}

export interface IAnalyticsData {
  series: IAnalyticsDayEntry[];
  totalRevenue: number;
  avgTicket: number;
  bestDay: { date: string; revenue: number } | null;
  mostActiveBooth: { name: string; sessions: number } | null;
  topEvents: Array<{ id: string; name: string; revenue: number }>;
}
```

- [ ] **Step 2: Build shared package to verify no TypeScript errors**

```bash
cd packages/shared && npm run build && cd ../..
```
Expected: `dist/types.js` and `dist/types.d.ts` created with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): update types for template pools, analytics, digital upsell"
```

---

## Task 2: Prisma schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Replace `apps/api/prisma/schema.prisma`**

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
  name                String
  maxBooths           Int
  maxSessionsPerMonth Int
  tenants             Tenant[]
  createdAt           DateTime @default(now())
}

model Tenant {
  id           String     @id @default(uuid())
  name         String
  email        String     @unique
  passwordHash String
  logoUrl      String?
  primaryColor String?
  brandName    String?
  planId       String?
  plan         Plan?      @relation(fields: [planId], references: [id])
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  booths       Booth[]
  events       Event[]
  templates    Template[]
}

model Booth {
  id                  String         @id @default(uuid())
  name                String
  token               String         @unique
  tenantId            String
  tenant              Tenant         @relation(fields: [tenantId], references: [id])
  offlineMode         String         @default("BLOCK")
  offlineCredits      Int            @default(0)
  demoSessionsPerHour Int            @default(3)
  cameraSound         Boolean        @default(true)
  activeEventId       String?
  activeEvent         Event?         @relation("BoothActiveEvent", fields: [activeEventId], references: [id])
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  payments            Payment[]
  photoSessions       PhotoSession[]
}

model Event {
  id             String          @id @default(uuid())
  name           String
  price          Decimal
  photoCount     Int             @default(1)
  digitalPrice   Decimal?
  backgroundUrl  String?
  maxTemplates   Int             @default(5)
  tenantId       String
  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  eventTemplates EventTemplate[]
  payments       Payment[]
  photoSessions  PhotoSession[]
  booths         Booth[]         @relation("BoothActiveEvent")
}

model Template {
  id             String          @id @default(uuid())
  name           String
  overlayUrl     String
  tenantId       String
  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  eventTemplates EventTemplate[]
}

model EventTemplate {
  eventId    String
  templateId String
  order      Int
  event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  template   Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@id([eventId, templateId])
  @@index([eventId, order])
}

model Payment {
  id           String        @id @default(uuid())
  externalId   String?       @unique
  qrCode       String?
  qrCodeBase64 String?
  amount       Decimal
  status       String        @default("PENDING")
  paymentType  String        @default("MAIN")
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

- [ ] **Step 2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name template-event-redesign && cd ../..
```
Expected: Migration created and applied. New tables/columns present. No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): template pool, event templates, booth active event, digital price, paymentType"
```

---

## Task 3: S3 generic upload + template CRUD endpoints

**Files:**
- Modify: `apps/api/src/adapters/storage/s3.adapter.ts`
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/controllers/tenant.controller.spec.ts`

- [ ] **Step 1: Write failing tests for template CRUD**

Add at the bottom of `apps/api/src/controllers/tenant.controller.spec.ts`:

```ts
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';

// Add to the mockPrisma at the top of the file:
// template: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
// eventTemplate: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },

describe('TenantController — templates', () => {
  let controller: TenantController;
  const mockS3 = { uploadFile: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset template mock on the shared mockPrisma
    (mockPrisma as any).template = {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    };
    (mockPrisma as any).eventTemplate = {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
        { provide: S3StorageAdapter, useValue: mockS3 },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('GET /tenant/templates returns tenant templates', async () => {
    (mockPrisma as any).template.findMany.mockResolvedValue([
      { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', tenantId: 'tenant-1', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const result = await controller.getTemplates(TENANT_USER as any);

    expect((mockPrisma as any).template.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-1');
  });

  it('DELETE /tenant/templates/:id deletes only tenant template', async () => {
    (mockPrisma as any).template.deleteMany.mockResolvedValue({ count: 1 });

    const result = await controller.deleteTemplate('t-1', TENANT_USER as any);

    expect((mockPrisma as any).template.deleteMany).toHaveBeenCalledWith({
      where: { id: 't-1', tenantId: 'tenant-1' },
    });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/api && npm test -- --testPathPattern=tenant.controller.spec && cd ../..
```
Expected: FAIL (S3StorageAdapter not injected, getTemplates not defined)

- [ ] **Step 3: Replace `apps/api/src/adapters/storage/s3.adapter.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.AWS_S3_BUCKET_NAME;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadPhoto(sessionId: string, base64Data: string): Promise<string> {
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    return this.uploadFile(`sessions/${sessionId}`, buffer, 'image/png');
  }

  async uploadFile(folder: string, buffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1] ?? 'png';
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      let url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      if (process.env.AWS_CLOUDFRONT_DOMAIN) {
        url = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`;
      }
      this.logger.log(`File uploaded: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('Error uploading file to S3', error);
      throw new Error('Failed to upload file to cloud storage');
    }
  }
}
```

- [ ] **Step 4: Install `@types/multer`**

```bash
cd apps/api && npm install --save-dev @types/multer && cd ../..
```

- [ ] **Step 5: Replace `apps/api/src/controllers/tenant.controller.ts`**

```ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import {
  TenantMetrics,
  IBoothWithStatus,
  ITemplate,
  IEventTemplate,
  IAnalyticsData,
  OfflineMode,
  PaginatedResponse,
  IGallerySession,
  IPaymentRecord,
  ITenantSettings,
  UpdateTenantSettingsDto,
} from '@packages/shared';

interface AuthReq {
  user: RequestUser;
}

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boothGateway: BoothGateway,
    private readonly s3: S3StorageAdapter,
  ) {}

  @Get('metrics')
  async getMetrics(@Request() req: AuthReq): Promise<TenantMetrics> {
    const { tenantId } = req.user;
    const where = { booth: { tenantId } };

    const [approved, expired, rejected, revenueAgg, totalSessions] = await Promise.all([
      this.prisma.payment.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.payment.count({ where: { ...where, status: 'EXPIRED' } }),
      this.prisma.payment.count({ where: { ...where, status: 'REJECTED' } }),
      this.prisma.payment.aggregate({ where: { ...where, status: 'APPROVED' }, _sum: { amount: true } }),
      this.prisma.photoSession.count({ where: { booth: { tenantId } } }),
    ]);

    const resolved = approved + expired + rejected;
    const conversionRate = resolved === 0 ? 0 : Math.round((approved / resolved) * 100);

    return {
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      totalSessions,
      conversionRate,
      activeBooths: this.boothGateway.getOnlineBoothCount(tenantId),
    };
  }

  @Get('booths')
  async getBooths(@Request() req: AuthReq): Promise<IBoothWithStatus[]> {
    const { tenantId } = req.user;
    const booths = await this.prisma.booth.findMany({
      where: { tenantId },
      include: { activeEvent: { select: { id: true, name: true } } },
    });
    return booths.map((b) => ({
      ...b,
      offlineMode: b.offlineMode as OfflineMode,
      isOnline: this.boothGateway.isBoothOnline(b.id),
      activeEvent: b.activeEvent,
    }));
  }

  @Post('booths')
  async createBooth(
    @Body() body: { name: string; offlineMode?: string },
    @Request() req: AuthReq,
  ) {
    const { tenantId } = req.user;
    return this.prisma.booth.create({
      data: {
        name: body.name,
        token: randomUUID(),
        tenantId,
        offlineMode: body.offlineMode ?? 'BLOCK',
      },
    });
  }

  @Get('photos')
  async getPhotos(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('boothId') boothId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PaginatedResponse<IGallerySession>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { booth: { tenantId } };
    if (boothId) where.boothId = boothId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      this.prisma.photoSession.findMany({
        where,
        include: { event: { select: { name: true } }, booth: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.photoSession.count({ where }),
    ]);

    return {
      data: sessions.map((s) => ({
        sessionId: s.id,
        photoUrls: s.photoUrls,
        eventName: s.event.name,
        boothName: s.booth.name,
        createdAt: s.createdAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  @Get('payments')
  async getPayments(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PaginatedResponse<IPaymentRecord>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { booth: { tenantId } };
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          event: { select: { name: true } },
          booth: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status as any,
        eventName: p.event.name,
        boothName: p.booth.name,
        paymentType: (p.paymentType as 'MAIN' | 'DIGITAL') ?? 'MAIN',
        createdAt: p.createdAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  @Get('settings')
  async getSettings(@Request() req: AuthReq): Promise<ITenantSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Put('settings')
  async updateSettings(
    @Body() body: UpdateTenantSettingsDto,
    @Request() req: AuthReq,
  ): Promise<ITenantSettings> {
    return this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: body,
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get('templates')
  async getTemplates(@Request() req: AuthReq): Promise<ITemplate[]> {
    return this.prisma.template.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  @Post('templates')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemplate(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Request() req: AuthReq,
  ): Promise<ITemplate> {
    const url = await this.s3.uploadFile('templates', file.buffer, file.mimetype);
    return this.prisma.template.create({
      data: { name, overlayUrl: url, tenantId: req.user.tenantId },
    }) as any;
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string, @Request() req: AuthReq) {
    await this.prisma.template.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    return { ok: true };
  }

  @Get('events/:id/templates')
  async getEventTemplates(
    @Param('id') eventId: string,
    @Request() req: AuthReq,
  ): Promise<IEventTemplate[]> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId: req.user.tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.eventTemplate.findMany({
      where: { eventId },
      include: { template: true },
      orderBy: { order: 'asc' },
    }) as any;
  }

  @Put('events/:id/templates')
  async setEventTemplates(
    @Param('id') eventId: string,
    @Body() body: { templateIds: string[] },
    @Request() req: AuthReq,
  ): Promise<IEventTemplate[]> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId: req.user.tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.eventTemplate.deleteMany({ where: { eventId } });
    if (body.templateIds.length > 0) {
      await this.prisma.eventTemplate.createMany({
        data: body.templateIds.map((templateId, order) => ({ eventId, templateId, order })),
      });
    }
    return this.getEventTemplates(eventId, req);
  }

  @Put('booths/:id/event')
  async setBoothEvent(
    @Param('id') boothId: string,
    @Body() body: { eventId: string | null },
    @Request() req: AuthReq,
  ) {
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, tenantId: req.user.tenantId },
    });
    if (!booth) throw new NotFoundException('Booth not found');
    return this.prisma.booth.update({
      where: { id: boothId },
      data: { activeEventId: body.eventId },
    });
  }

  @Post('settings/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthReq,
  ): Promise<{ logoUrl: string }> {
    const url = await this.s3.uploadFile('logos', file.buffer, file.mimetype);
    await this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: { logoUrl: url },
    });
    return { logoUrl: url };
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  @Get('analytics')
  async getAnalytics(
    @Request() req: AuthReq,
    @Query('period') period = '30d',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<IAnalyticsData> {
    const { tenantId } = req.user;
    const endDate = to ? new Date(to) : new Date();
    let startDate: Date;
    if (from) {
      startDate = new Date(from);
    } else {
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);
    }

    const dateFilter = { gte: startDate, lte: endDate };
    const tenantFilter = { booth: { tenantId } };

    const [payments, sessions, topBoothRows] = await Promise.all([
      this.prisma.payment.findMany({
        where: { ...tenantFilter, status: 'APPROVED', createdAt: dateFilter },
        include: { event: { select: { id: true, name: true } } },
      }),
      this.prisma.photoSession.findMany({
        where: { ...tenantFilter, createdAt: dateFilter },
        select: { createdAt: true },
      }),
      this.prisma.photoSession.groupBy({
        by: ['boothId'],
        where: { ...tenantFilter, createdAt: dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
    ]);

    const dayMap = new Map<string, { revenue: number; sessions: number }>();
    const getOrCreate = (d: string) => {
      if (!dayMap.has(d)) dayMap.set(d, { revenue: 0, sessions: 0 });
      return dayMap.get(d)!;
    };
    for (const p of payments) {
      getOrCreate(p.createdAt.toISOString().slice(0, 10)).revenue += Number(p.amount);
    }
    for (const s of sessions) {
      getOrCreate(s.createdAt.toISOString().slice(0, 10)).sessions += 1;
    }
    const series = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, sessions }]) => ({ date, revenue, sessions }));

    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const avgTicket = payments.length === 0 ? 0 : totalRevenue / payments.length;

    let bestDay: { date: string; revenue: number } | null = null;
    for (const [date, { revenue }] of dayMap) {
      if (!bestDay || revenue > bestDay.revenue) bestDay = { date, revenue };
    }

    let mostActiveBooth: { name: string; sessions: number } | null = null;
    if (topBoothRows.length > 0) {
      const booth = await this.prisma.booth.findUnique({
        where: { id: topBoothRows[0].boothId },
        select: { name: true },
      });
      if (booth) mostActiveBooth = { name: booth.name, sessions: topBoothRows[0]._count.id };
    }

    const eventRevMap = new Map<string, { name: string; revenue: number }>();
    for (const p of payments) {
      const e = eventRevMap.get(p.eventId) ?? { name: p.event.name, revenue: 0 };
      e.revenue += Number(p.amount);
      eventRevMap.set(p.eventId, e);
    }
    const topEvents = Array.from(eventRevMap.entries())
      .map(([id, { name, revenue }]) => ({ id, name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { series, totalRevenue, avgTicket, bestDay, mostActiveBooth, topEvents };
  }
}
```

- [ ] **Step 6: Run tests — verify pass**

```bash
cd apps/api && npm test -- --testPathPattern=tenant.controller.spec && cd ../..
```
Expected: all tests pass including new template/analytics tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/adapters/storage/s3.adapter.ts
git add apps/api/src/controllers/tenant.controller.ts
git add apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): template pool CRUD, event-template assignment, analytics, logo upload, booth event setter"
```

---

## Task 4: Update Event controller (new fields)

**Files:**
- Modify: `apps/api/src/controllers/event.controller.ts`
- Modify: `apps/api/src/controllers/event.controller.spec.ts`

- [ ] **Step 1: Write failing test**

Replace `apps/api/src/controllers/event.controller.spec.ts` with:

```ts
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
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/api && npm test -- --testPathPattern=event.controller.spec && cd ../..
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/api/src/controllers/event.controller.ts`**

```ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';

interface AuthReq {
  user: RequestUser;
}

interface CreateEventDto {
  name: string;
  price: number;
  photoCount?: number;
  digitalPrice?: number | null;
  backgroundUrl?: string | null;
  maxTemplates?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Request() req: AuthReq) {
    return this.prisma.event.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() data: CreateEventDto, @Request() req: AuthReq) {
    return this.prisma.event.create({
      data: {
        name: data.name,
        price: data.price,
        photoCount: data.photoCount ?? 1,
        digitalPrice: data.digitalPrice ?? null,
        backgroundUrl: data.backgroundUrl ?? null,
        maxTemplates: data.maxTemplates ?? 5,
        tenantId: req.user.tenantId,
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: CreateEventDto) {
    return this.prisma.event.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
        photoCount: data.photoCount,
        digitalPrice: data.digitalPrice,
        backgroundUrl: data.backgroundUrl,
        maxTemplates: data.maxTemplates,
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.event.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/api && npm test -- --testPathPattern=event.controller.spec && cd ../..
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/event.controller.ts apps/api/src/controllers/event.controller.spec.ts
git commit -m "feat(api): event CRUD handles digitalPrice, backgroundUrl, maxTemplates"
```

---

## Task 5: Update Booths controller (activeEventId + new BoothEventResponseDto)

**Files:**
- Modify: `apps/api/src/controllers/booths.controller.ts`
- Modify: `apps/api/src/controllers/booths.controller.spec.ts`

- [ ] **Step 1: Write failing tests**

Replace `apps/api/src/controllers/booths.controller.spec.ts` with:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  booth: { findFirst: jest.fn(), findUnique: jest.fn() },
  event: { findUnique: jest.fn() },
};

describe('BoothsController — getBoothEvent', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get(BoothsController);
  });

  it('throws UnauthorizedException when no token', async () => {
    await expect(controller.getBoothEvent('b-1', undefined as any)).rejects.toThrow(UnauthorizedException);
  });

  it('throws NotFoundException when booth has no activeEventId', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'b-1', token: 'tok', activeEventId: null });

    await expect(controller.getBoothEvent('b-1', 'Bearer tok')).rejects.toThrow(NotFoundException);
  });

  it('returns event with ordered templates when activeEventId is set', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'b-1', token: 'tok', activeEventId: 'ev-1' });
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'ev-1', name: 'Wedding', price: 30, photoCount: 4,
      digitalPrice: 5, backgroundUrl: null, maxTemplates: 3,
      eventTemplates: [
        { order: 0, template: { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png' } },
        { order: 1, template: { id: 't-2', name: 'Gold', overlayUrl: 'https://s3/t2.png' } },
      ],
    });

    const result = await controller.getBoothEvent('b-1', 'Bearer tok');

    expect(result.event.digitalPrice).toBe(5);
    expect(result.event.maxTemplates).toBe(3);
    expect(result.templates).toHaveLength(2);
    expect(result.templates[0].id).toBe('t-1');
    expect(result.templates[0].order).toBe(0);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/api && npm test -- --testPathPattern=booths.controller.spec && cd ../..
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/api/src/controllers/booths.controller.ts`**

```ts
import {
  Controller,
  Get,
  Param,
  Headers,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothConfigDto, BoothEventResponseDto, OfflineMode } from '@packages/shared';

@Controller('booths')
export class BoothsController {
  private readonly logger = new Logger(BoothsController.name);

  constructor(private readonly prisma: PrismaService) {}

  private extractToken(auth: string | undefined): string | undefined {
    return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  }

  @Get(':id/config')
  async getConfig(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ): Promise<BoothConfigDto> {
    const token = this.extractToken(auth);
    if (!token) throw new UnauthorizedException();

    const booth = await this.prisma.booth.findFirst({
      where: { id, token },
      include: { tenant: true },
    });
    if (!booth) throw new UnauthorizedException();

    if (!Object.values(OfflineMode).includes(booth.offlineMode as OfflineMode)) {
      throw new InternalServerErrorException(`Unknown offlineMode: ${booth.offlineMode}`);
    }

    return {
      offlineMode: booth.offlineMode as OfflineMode,
      offlineCredits: booth.offlineCredits,
      demoSessionsPerHour: booth.demoSessionsPerHour,
      cameraSound: booth.cameraSound,
      branding: {
        logoUrl: booth.tenant.logoUrl,
        primaryColor: booth.tenant.primaryColor,
        brandName: booth.tenant.brandName,
      },
    };
  }

  @Get(':id/event')
  async getBoothEvent(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ): Promise<BoothEventResponseDto> {
    const token = this.extractToken(auth);
    if (!token) throw new UnauthorizedException();

    const booth = await this.prisma.booth.findFirst({ where: { id, token } });
    if (!booth) throw new UnauthorizedException();
    if (!booth.activeEventId) throw new NotFoundException('No active event configured for this booth');

    const event = await this.prisma.event.findUnique({
      where: { id: booth.activeEventId },
      include: {
        eventTemplates: {
          orderBy: { order: 'asc' },
          include: { template: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Active event not found');

    const validPhotoCounts = [1, 2, 4] as const;
    if (!validPhotoCounts.includes(event.photoCount as 1 | 2 | 4)) {
      throw new InternalServerErrorException(`Invalid photoCount: ${event.photoCount}`);
    }

    return {
      event: {
        id: event.id,
        name: event.name,
        price: event.price.toNumber(),
        photoCount: event.photoCount as 1 | 2 | 4,
        digitalPrice: event.digitalPrice?.toNumber() ?? null,
        backgroundUrl: event.backgroundUrl,
        maxTemplates: event.maxTemplates,
      },
      templates: event.eventTemplates.map((et) => ({
        id: et.template.id,
        name: et.template.name,
        overlayUrl: et.template.overlayUrl,
        order: et.order,
      })),
    };
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/api && npm test -- --testPathPattern=booths.controller.spec && cd ../..
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/booths.controller.ts apps/api/src/controllers/booths.controller.spec.ts
git commit -m "feat(api): booths controller uses activeEventId, returns new BoothEventResponseDto"
```

---

## Task 6: Digital payment use case + payment status endpoint

**Files:**
- Create: `apps/api/src/use-cases/create-digital-payment.use-case.ts`
- Modify: `apps/api/src/controllers/payment.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create `apps/api/src/use-cases/create-digital-payment.use-case.ts`**

```ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PixPaymentResponse } from '@packages/shared';

@Injectable()
export class CreateDigitalPaymentUseCase {
  private readonly logger = new Logger(CreateDigitalPaymentUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
    @InjectQueue('payment-expiration') private readonly paymentQueue: Queue,
  ) {}

  async execute(sessionId: string): Promise<PixPaymentResponse> {
    const session = await this.prisma.photoSession.findUnique({
      where: { id: sessionId },
      include: { event: true, booth: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!session.event.digitalPrice) {
      throw new BadRequestException('Digital download is free for this event');
    }

    const amount = session.event.digitalPrice.toNumber();
    const mpResponse = await this.mpAdapter.createPixPayment({
      amount,
      description: `Digital Download — ${session.event.name}`,
      metadata: { boothId: session.boothId, eventId: session.eventId, sessionId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        externalId: mpResponse.externalId.toString(),
        amount,
        qrCode: mpResponse.qrCode,
        qrCodeBase64: mpResponse.qrCodeBase64,
        status: 'PENDING',
        paymentType: 'DIGITAL',
        boothId: session.boothId,
        eventId: session.eventId,
      },
    });

    await this.paymentQueue.add(
      'expire-payment',
      { paymentId: payment.id, boothId: session.boothId },
      { delay: 2 * 60 * 1000 },
    );

    this.logger.log(`Digital payment created: ${payment.id} for session ${sessionId}`);
    return {
      paymentId: payment.id,
      qrCode: mpResponse.qrCode,
      qrCodeBase64: mpResponse.qrCodeBase64,
      expiresIn: 120,
    };
  }
}
```

- [ ] **Step 2: Replace `apps/api/src/controllers/payment.controller.ts`**

```ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CreatePixPaymentUseCase } from '../use-cases/create-pix-payment.use-case';
import { CreateDigitalPaymentUseCase } from '../use-cases/create-digital-payment.use-case';
import { ProcessWebhookUseCase } from '../use-cases/process-webhook.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePixPaymentDTO } from '@packages/shared';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly createPixPaymentUseCase: CreatePixPaymentUseCase,
    private readonly createDigitalPaymentUseCase: CreateDigitalPaymentUseCase,
    private readonly processWebhookUseCase: ProcessWebhookUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post('pix')
  async createPixPayment(@Body() dto: CreatePixPaymentDTO) {
    return this.createPixPaymentUseCase.execute(dto);
  }

  @Post('digital/:sessionId')
  async createDigitalPayment(@Param('sessionId') sessionId: string) {
    return this.createDigitalPaymentUseCase.execute(sessionId);
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    return { id: payment.id, status: payment.status, paymentType: payment.paymentType };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Webhook received from Mercado Pago');
    this.processWebhookUseCase.execute(payload).catch((err) => {
      this.logger.error('Error processing webhook', err);
    });
    return { received: true };
  }
}
```

- [ ] **Step 3: Register CreateDigitalPaymentUseCase in `apps/api/src/app.module.ts`**

In `apps/api/src/app.module.ts`, add the import and registration:

```ts
// Add import at top:
import { CreateDigitalPaymentUseCase } from './use-cases/create-digital-payment.use-case';

// Add to providers array (after CreatePixPaymentUseCase):
CreateDigitalPaymentUseCase,
```

The complete providers array in app.module.ts should be:

```ts
providers: [
  PrismaService,
  BoothGateway,
  DashboardGateway,
  MercadoPagoAdapter,
  CreatePixPaymentUseCase,
  CreateDigitalPaymentUseCase,
  ProcessWebhookUseCase,
  PaymentExpirationProcessor,
  S3StorageAdapter,
  SyncPhotoUseCase,
],
```

- [ ] **Step 4: Run all API tests**

```bash
cd apps/api && npm test && cd ../..
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/create-digital-payment.use-case.ts
git add apps/api/src/controllers/payment.controller.ts
git add apps/api/src/app.module.ts
git commit -m "feat(api): digital payment use case, payment status endpoint, register use case"
```
