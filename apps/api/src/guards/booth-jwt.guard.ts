import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class BoothJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();

    let payload: any;
    try {
      payload = this.jwt.verify(auth.slice(7));
    } catch {
      throw new UnauthorizedException();
    }

    if (payload.role !== 'booth') throw new UnauthorizedException();
    const params = request.params as Record<string, string>;
    if (params?.id && params.id !== payload.sub) throw new UnauthorizedException();
    request.user = payload;
    return true;
  }
}
