import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useBoothEvent } from './useBoothEvent';

vi.mock('axios');

describe('useBoothEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns event with digitalPrice, backgroundUrl, maxTemplates', async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: {
        event: {
          id: 'ev-1', name: 'Wedding', price: 30, photoCount: 4,
          digitalPrice: 5, backgroundUrl: 'https://s3/bg.jpg', maxTemplates: 3,
        },
        templates: [
          { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', order: 0 },
        ],
      },
    });

    const { result } = renderHook(() => useBoothEvent('b-1', 'tok'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.event?.digitalPrice).toBe(5);
    expect(result.current.event?.backgroundUrl).toBe('https://s3/bg.jpg');
    expect(result.current.event?.maxTemplates).toBe(3);
    expect(result.current.templates[0].order).toBe(0);
  });

  it('sets error when request fails', async () => {
    (axios.get as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBoothEvent('b-1', 'bad-token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeTruthy();
  });
});
