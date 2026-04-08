// apps/api/src/auth/tenant.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guard that extracts the tenantId from the JWT or Header
 * In a production scenario with Clerk, we would verify the JWT here.
 * For this MVP, we'll look for a 'x-tenant-id' header or 'tenantId' query/body.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // In production with Clerk:
    // const auth = request.auth; // Injected by Clerk middleware
    // const tenantId = auth.sessionClaims?.metadata?.tenantId;

    const tenantId = request.headers['x-tenant-id'] || request.query.tenantId || request.body.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant identification is missing');
    }

    // Attach to request for use in controllers
    request.tenantId = tenantId;

    return true;
  }
}
