import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/jwt.strategy';

@WebSocketGateway({ cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth['token'] as string;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data['tenantId'] = payload.sub;
      client.join(`tenant:${payload.sub}`);
      this.logger.log(`Dashboard client connected: tenant=${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  broadcastToTenant(tenantId: string, event: string, data?: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }
}
