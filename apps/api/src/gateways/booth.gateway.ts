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
import { UseFilters, UseGuards } from '@nestjs/common';
import { BoothState } from '@packages/shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'booth',
})
export class BoothGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedBooths = new Map<string, string>(); // boothId -> socketId

  async handleConnection(client: Socket) {
    const boothId = client.handshake.query.boothId as string;
    const token = client.handshake.headers.authorization;

    // TODO: Implement actual JWT/Token verification via BoothService
    if (!boothId || !token) {
      client.disconnect();
      return;
    }

    this.connectedBooths.set(boothId, client.id);
    console.log(`Booth connected: ${boothId}`);
  }

  handleDisconnect(client: Socket) {
    const boothId = Array.from(this.connectedBooths.entries()).find(
      ([_, id]) => id === client.id,
    )?.[0];
    
    if (boothId) {
      this.connectedBooths.delete(boothId);
      console.log(`Booth disconnected: ${boothId}`);
    }
  }

  @SubscribeMessage('update_state')
  handleStateUpdate(
    @MessageBody() data: { boothId: string; state: BoothState },
    @ConnectedSocket() client: Socket,
  ) {
    // Notify dashboard or other interested parties about the booth state change
    console.log(`Booth ${data.boothId} updated state to ${data.state}`);
  }

  sendPaymentApproved(boothId: string, payload: any) {
    const socketId = this.connectedBooths.get(boothId);
    if (socketId) {
      this.server.to(socketId).emit('payment_approved', payload);
    }
  }
}
