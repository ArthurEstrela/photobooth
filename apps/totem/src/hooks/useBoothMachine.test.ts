import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBoothMachine } from './useBoothMachine';
import { BoothState, OfflineMode, BoothConfigDto } from '@packages/shared';
import axios from 'axios';

vi.mock('axios');
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    handshake: { query: {} },
  })),
}));

const mockAxios = vi.mocked(axios);

const mockConfig: BoothConfigDto = {
  offlineMode: OfflineMode.BLOCK,
  offlineCredits: 5,
  demoSessionsPerHour: 3,
  cameraSound: true,
  branding: { logoUrl: null, primaryColor: '#3b82f6', brandName: null },
};

describe('useBoothMachine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in IDLE state', () => {
    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );
    expect(result.current.state).toBe(BoothState.IDLE);
  });

  it('transitions to WAITING_PAYMENT and sets currentPayment on successful startPayment', async () => {
    mockAxios.post = vi.fn().mockResolvedValue({
      data: { paymentId: 'pay-1', qrCode: 'abc', qrCodeBase64: 'base64', expiresIn: 120 },
    });

    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );

    act(() => {
      result.current.startPayment('ev-1', 't1', 25);
    });

    expect(result.current.state).toBe(BoothState.WAITING_PAYMENT);

    await waitFor(() => expect(result.current.currentPayment?.paymentId).toBe('pay-1'));
  });

  it('transitions to IDLE when API fails and offlineMode is BLOCK', async () => {
    mockAxios.post = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', { ...mockConfig, offlineMode: OfflineMode.BLOCK }),
    );

    await act(async () => {
      await result.current.startPayment('ev-1', 't1', 25);
    });

    expect(result.current.state).toBe(BoothState.IDLE);
  });

  it('transitions to IN_SESSION when API fails and offlineMode is DEMO', async () => {
    mockAxios.post = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', { ...mockConfig, offlineMode: OfflineMode.DEMO }),
    );

    await act(async () => {
      await result.current.startPayment('ev-1', 't1', 25);
    });

    expect(result.current.state).toBe(BoothState.IN_SESSION);
  });

  it('transitions to PROCESSING after onPhotoTaken called photoCount times', () => {
    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );

    act(() => result.current.onPhotoTaken('data:photo1', 2));
    expect(result.current.state).toBe(BoothState.COUNTDOWN);

    act(() => result.current.onPhotoTaken('data:photo2', 2));
    expect(result.current.state).toBe(BoothState.PROCESSING);
    expect(result.current.capturedPhotos).toHaveLength(2);
  });

  it('transitions to DELIVERY and resets to IDLE after completeSession', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );

    await act(async () => {
      await result.current.completeSession('data:strip');
    });

    expect(result.current.state).toBe(BoothState.DELIVERY);

    act(() => vi.advanceTimersByTime(8000));
    expect(result.current.state).toBe(BoothState.IDLE);

    vi.useRealTimers();
  });
});
