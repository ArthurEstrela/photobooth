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
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BoothStateUpdate, HardwareUpdateEvent, DeviceHeartbeatEvent, DeviceStatusEvent } from '@packages/shared';
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
  private boothDevices = new Map<string, DeviceStatusEvent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardGateway: DashboardGateway,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers['authorization'];
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

      if (!token) {
        client.disconnect();
        return;
      }

      // Validate booth JWT (new pairing flow)
      let boothId: string;
      let tenantId: string;
      try {
        const payload = this.jwt.verify(token) as any;
        if (payload.role !== 'booth') throw new Error('not a booth token');
        boothId = payload.sub;
        tenantId = payload.tenantId;
      } catch {
        this.logger.warn(`Connection rejected — invalid booth JWT`);
        client.disconnect();
        return;
      }

      this.connectedBooths.set(boothId, { socketId: client.id, tenantId });
      client.data['boothId'] = boothId;
      this.dashboardGateway.broadcastToTenant(tenantId, 'booth_status', {
        boothId,
        online: true,
      });
      this.logger.log(`Booth connected: ${boothId}`);

      // Sync: push current DB config to totem on reconnect so it starts with authoritative state
      const dbBooth = await this.prisma.booth.findUnique({ where: { id: boothId } });
      if (dbBooth && (dbBooth.selectedCamera || dbBooth.selectedPrinter)) {
        this.sendForceHardwareUpdate(boothId, {
          selectedCamera: dbBooth.selectedCamera ?? null,
          selectedPrinter: dbBooth.selectedPrinter ?? null,
        });
      }
    } catch (err) {
      this.logger.error(`Error during booth connection: ${(err as Error).message}`);
      client.disconnect();
    }
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

  @SubscribeMessage('device_heartbeat')
  async handleDeviceHeartbeat(
    @MessageBody() data: DeviceHeartbeatEvent,
    @ConnectedSocket() client: Socket,
  ) {
    const boothId = client.data['boothId'] as string | undefined;
    if (!boothId) return;
    const entry = this.connectedBooths.get(boothId);
    if (!entry) return;

    const status: DeviceStatusEvent = { ...data, boothId, lastSeen: new Date().toISOString() };
    this.boothDevices.set(boothId, status);
    this.dashboardGateway.broadcastToTenant(entry.tenantId, 'device_status', status);
  }

  @SubscribeMessage('hardware_updated')
  async handleHardwareUpdated(
    @MessageBody() data: { selectedCamera: string | null; selectedPrinter: string | null },
    @ConnectedSocket() client: Socket,
  ) {
    const boothId = client.data['boothId'] as string | undefined;
    if (!boothId) return;
    const entry = this.connectedBooths.get(boothId);
    if (!entry) return;

    await this.prisma.booth.update({
      where: { id: boothId },
      data: {
        ...(data.selectedCamera !== undefined && { selectedCamera: data.selectedCamera }),
        ...(data.selectedPrinter !== undefined && { selectedPrinter: data.selectedPrinter }),
      },
    });

    const existing = this.boothDevices.get(boothId);
    if (existing) {
      const updated: DeviceStatusEvent = {
        ...existing,
        ...(data.selectedCamera !== undefined && { selectedCamera: data.selectedCamera }),
        ...(data.selectedPrinter !== undefined && { selectedPrinter: data.selectedPrinter }),
        lastSeen: new Date().toISOString(),
      };
      this.boothDevices.set(boothId, updated);
      this.dashboardGateway.broadcastToTenant(entry.tenantId, 'device_status', updated);
    }

    this.logger.log(`Booth ${boothId} updated hardware locally`);
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
