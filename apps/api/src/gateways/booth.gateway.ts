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
