import { MercadoPagoAdapter } from './mercadopago.adapter';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MercadoPagoAdapter', () => {
  let adapter: MercadoPagoAdapter;

  beforeEach(() => {
    adapter = new MercadoPagoAdapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the provided accessToken in the Authorization header', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        id: 999,
        point_of_interaction: {
          transaction_data: {
            qr_code: 'qr-string',
            qr_code_base64: 'base64-string',
          },
        },
        status: 'pending',
      },
    });

    await adapter.createPixPayment('MY_ACCESS_TOKEN', {
      amount: 50,
      description: 'Test',
      metadata: {},
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/payments'),
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer MY_ACCESS_TOKEN',
        }),
      }),
    );
  });

  it('returns mock data in dev when MP API fails', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    mockedAxios.post.mockRejectedValue(new Error('network error'));

    const result = await adapter.createPixPayment('token', {
      amount: 10,
      description: 'Test',
      metadata: {},
    });

    expect(result.qrCode).toBeTruthy();
    expect(result.externalId).toBeTruthy();
    process.env.NODE_ENV = originalEnv;
  });
});
