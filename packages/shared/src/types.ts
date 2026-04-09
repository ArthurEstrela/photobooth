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

export interface BoothEventResponseDto {
  event: {
    id: string;
    name: string;
    price: number;
    photoCount: 1 | 2 | 4;
  };
  templates: ITemplate[];
}

export interface IBoothWithStatus extends IBooth {
  isOnline: boolean;
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

