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
import { BoothStateUpdate, HardwareUpdateEvent } from '@packages/shared';
import { DashboardGateway } from './dashboard.gateway';

interface BoothEntry {
  socketId: string;
  tenantId: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'booth' })
export class BoothGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BoothGateway.name);
  private connectedBooths = new Map<string, BoothEntry>(); // boothId → { socketId, tenantId }

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async handleConnection(client: Socket) {
    const boothId = client.handshake.query['boothId'] as string;
    const authHeader = client.handshake.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

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

    this.connectedBooths.set(boothId, { socketId: client.id, tenantId: booth.tenantId });
    this.dashboardGateway.broadcastToTenant(booth.tenantId, 'booth_status', {
      boothId,
      online: true,
    });
    this.logger.log(`Booth connected: ${boothId}`);
  }

  handleDisconnect(client: Socket) {
    const entry = Array.from(this.connectedBooths.entries()).find(
      ([, e]) => e.socketId === client.id,
    );

    if (entry) {
      const [boothId, { tenantId }] = entry;
      this.connectedBooths.delete(boothId);
      this.dashboardGateway.broadcastToTenant(tenantId, 'booth_status', {
        boothId,
        online: false,
      });
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

  isBoothOnline(boothId: string): boolean {
    return this.connectedBooths.has(boothId);
  }

  getOnlineBoothCount(tenantId: string): number {
    let count = 0;
    for (const entry of this.connectedBooths.values()) {
      if (entry.tenantId === tenantId) count++;
    }
    return count;
  }

  sendPaymentApproved(boothId: string, payload: unknown) {
    const entry = this.connectedBooths.get(boothId);
    if (entry) {
      this.server.to(entry.socketId).emit('payment_approved', payload);
    }
  }

  sendPaymentExpired(boothId: string) {
    const entry = this.connectedBooths.get(boothId);
    if (entry) {
      this.server.to(entry.socketId).emit('payment_expired');
    }
  }

  sendForceHardwareUpdate(boothId: string, payload: HardwareUpdateEvent) {
    const entry = this.connectedBooths.get(boothId);
    if (entry) {
      this.server.to(entry.socketId).emit('force_hardware_update', payload);
      this.logger.log(`force_hardware_update sent to booth ${boothId}`);
    }
  }
}
