// packages/shared/src/types.ts

export enum BoothState {
  IDLE = 'IDLE',
  WAITING_PAYMENT = 'WAITING_PAYMENT',
  IN_SESSION = 'IN_SESSION',
  PROCESSING = 'PROCESSING',
  DELIVERY = 'DELIVERY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export interface PaymentApprovedEvent {
  paymentId: string;
  transactionId: string;
  amount: number;
}

export interface BoothStateUpdate {
  boothId: string;
  state: BoothState;
}

export interface CreatePixPaymentDTO {
  boothId: string;
  eventId: string;
  amount: number;
}

export interface PixPaymentResponse {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresIn: number;
}

export interface PhotoSessionDTO {
  eventId: string;
  boothId: string;
  paymentId: string;
  photoUrls: string[];
}
