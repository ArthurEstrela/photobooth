import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBoothCredentials } from './useBoothCredentials';

const mockTotemAPI = {
  getCredentials: vi.fn(),
  setCredentials: vi.fn(),
  clearCredentials: vi.fn(),
};

beforeEach(() => {
  (window as any).totemAPI = mockTotemAPI;
  vi.clearAllMocks();
});

describe('useBoothCredentials', () => {
  it('returns credentials from electron-store on mount', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue({ boothId: 'b-1', boothToken: 'jwt-abc' });

    const { result } = renderHook(() => useBoothCredentials());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boothId).toBe('b-1');
    expect(result.current.boothToken).toBe('jwt-abc');
  });

  it('returns null credentials when store is empty', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue(null);

    const { result } = renderHook(() => useBoothCredentials());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boothId).toBeNull();
    expect(result.current.boothToken).toBeNull();
  });

  it('saves credentials and updates state', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue(null);
    mockTotemAPI.setCredentials.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoothCredentials());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setCredentials({ boothId: 'b-2', boothToken: 'jwt-xyz' });
    });

    expect(mockTotemAPI.setCredentials).toHaveBeenCalledWith({ boothId: 'b-2', boothToken: 'jwt-xyz' });
    expect(result.current.boothId).toBe('b-2');
    expect(result.current.boothToken).toBe('jwt-xyz');
  });

  it('clears credentials and resets state', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue({ boothId: 'b-1', boothToken: 'jwt-abc' });
    mockTotemAPI.clearCredentials.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoothCredentials());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.clearCredentials();
    });

    expect(mockTotemAPI.clearCredentials).toHaveBeenCalled();
    expect(result.current.boothId).toBeNull();
    expect(result.current.boothToken).toBeNull();
  });

  it('handles missing totemAPI gracefully (non-Electron env)', async () => {
    delete (window as any).totemAPI;

    const { result } = renderHook(() => useBoothCredentials());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boothId).toBeNull();
    expect(result.current.boothToken).toBeNull();
  });
});
