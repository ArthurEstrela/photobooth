import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  changePassword: jest.fn(),
  adminLogin: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('POST /auth/admin/login delegates to authService.adminLogin', async () => {
    mockAuthService.adminLogin.mockResolvedValue({ token: 'admin-jwt' });
    const result = await controller.adminLogin({ email: 'a@a.com', password: 'pw' });
    expect(mockAuthService.adminLogin).toHaveBeenCalledWith('a@a.com', 'pw');
    expect(result).toEqual({ token: 'admin-jwt' });
  });
});
