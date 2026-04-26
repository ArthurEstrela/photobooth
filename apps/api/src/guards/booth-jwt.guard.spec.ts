import { BoothJwtGuard } from './booth-jwt.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const mockJwt = { verify: jest.fn() };

function makeContext(auth: string | undefined, params: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: auth }, params }),
    }),
  } as any;
}

describe('BoothJwtGuard', () => {
  let guard: BoothJwtGuard;

  beforeEach(() => {
    guard = new BoothJwtGuard(mockJwt as unknown as JwtService);
    jest.clearAllMocks();
  });

  it('rejects when Authorization header is missing', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
  });

  it('rejects when header does not start with Bearer', () => {
    expect(() => guard.canActivate(makeContext('Basic abc'))).toThrow(UnauthorizedException);
  });

  it('rejects when JWT is invalid or expired', () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    expect(() => guard.canActivate(makeContext('Bearer bad-token'))).toThrow(UnauthorizedException);
  });

  it('rejects when role is not booth', () => {
    mockJwt.verify.mockReturnValue({ sub: 'b-1', role: 'admin' });
    expect(() => guard.canActivate(makeContext('Bearer valid'))).toThrow(UnauthorizedException);
  });

  it('rejects when :id param does not match token sub', () => {
    mockJwt.verify.mockReturnValue({ sub: 'b-1', role: 'booth' });
    expect(() => guard.canActivate(makeContext('Bearer valid', { id: 'b-2' }))).toThrow(UnauthorizedException);
  });

  it('allows valid booth token with matching :id param', () => {
    mockJwt.verify.mockReturnValue({ sub: 'b-1', role: 'booth', tenantId: 't-1' });
    const ctx = makeContext('Bearer valid', { id: 'b-1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows valid booth token with no :id param (e.g. POST /unpair)', () => {
    mockJwt.verify.mockReturnValue({ sub: 'b-1', role: 'booth', tenantId: 't-1' });
    const ctx = makeContext('Bearer valid', {});
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
