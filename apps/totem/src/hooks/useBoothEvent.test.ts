import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBoothEvent } from './useBoothEvent';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockResponse = {
  event: { id: 'ev-1', name: 'Casamento', price: 25, photoCount: 2 },
  templates: [
    { id: 't1', name: 'Rosa', overlayUrl: '/rosa.png', eventId: 'ev-1', createdAt: new Date(), updatedAt: new Date() },
  ],
};

describe('useBoothEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches event and templates', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useBoothEvent('booth-1', 'token-abc'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.event?.photoCount).toBe(2);
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].name).toBe('Rosa');
  });

  it('sets error when fetch fails', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useBoothEvent('booth-1', 'token-abc'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to load event');
  });
});
