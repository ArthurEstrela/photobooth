import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBoothConfig } from './useBoothConfig';
import axios from 'axios';
import { OfflineMode } from '@packages/shared';

vi.mock('axios');
const mockAxios = vi.mocked(axios);

const mockConfig = {
  offlineMode: OfflineMode.BLOCK,
  offlineCredits: 0,
  demoSessionsPerHour: 3,
  cameraSound: true,
  branding: { logoUrl: null, primaryColor: '#e91e63', brandName: 'Festa Tech' },
};

describe('useBoothConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches config and returns it', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: mockConfig });

    const { result } = renderHook(() => useBoothConfig('booth-1', 'token-abc'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.config?.offlineMode).toBe(OfflineMode.BLOCK);
    expect(result.current.config?.branding.brandName).toBe('Festa Tech');
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/booths/booth-1/config'),
      expect.objectContaining({ headers: { Authorization: 'Bearer token-abc' } }),
    );
  });

  it('applies --color-primary CSS variable when primaryColor is set', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: mockConfig });

    renderHook(() => useBoothConfig('booth-1', 'token-abc'));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#e91e63');
    });
  });

  it('sets error on fetch failure', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBoothConfig('booth-1', 'token-abc'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to load booth config');
    expect(result.current.config).toBeNull();
  });
});
