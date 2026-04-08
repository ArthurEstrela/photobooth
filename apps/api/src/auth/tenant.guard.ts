// apps/api/src/auth/tenant.guard.ts
//
// @deprecated Use JwtAuthGuard instead.
// Kept for backward compatibility during migration to JWT auth.

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      query: Record<string, string>;
      body: Record<string, string>;
      tenantId?: string;
    }>();

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
