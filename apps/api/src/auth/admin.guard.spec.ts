import { UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { JwtService } from '@nestjs/jwt';

const mockJwt = { verify: jest.fn() };

const makeContext = (token?: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      headers: { authorization: token ? `Bearer ${token}` : undefined },
    }),
  }),
});

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard(mockJwt as unknown as JwtService);
    jest.clearAllMocks();
  });

  it('rejects request with no Authorization header', () => {
    expect(() => guard.canActivate(makeContext() as any)).toThrow(UnauthorizedException);
  });

  it('rejects a token without role: admin', () => {
    mockJwt.verify.mockReturnValue({ sub: 'tenant-1', email: 't@t.com' });
    expect(() => guard.canActivate(makeContext('tenant-token') as any)).toThrow(UnauthorizedException);
  });

  it('rejects an impersonated token (impersonated: true)', () => {
    mockJwt.verify.mockReturnValue({ sub: 'admin', role: 'admin', impersonated: true });
    expect(() => guard.canActivate(makeContext('imp-token') as any)).toThrow(UnauthorizedException);
  });

  it('accepts a valid admin token and sets request.user', () => {
    const payload = { sub: 'admin', email: 'a@a.com', role: 'admin' };
    mockJwt.verify.mockReturnValue(payload);
    const req: any = { headers: { authorization: 'Bearer valid-admin-token' } };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toEqual(payload);
  });

  it('rejects a token that fails jwt.verify (expired/tampered)', () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    expect(() => guard.canActivate(makeContext('bad-token') as any)).toThrow(UnauthorizedException);
  });
});
