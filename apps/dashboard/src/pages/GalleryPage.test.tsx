import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GalleryPage } from './GalleryPage';

vi.mock('../hooks/api/useGallery', () => ({
  useGallery: () => ({
    data: {
      data: [
        {
          sessionId: 'sess-1',
          photoUrls: ['https://s3.example.com/p1.jpg', 'https://s3.example.com/p2.jpg'],
          eventName: 'Casamento João',
          boothName: 'Cabine Salão',
          createdAt: new Date('2026-01-15T10:30:00').toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    },
    isLoading: false,
  }),
}));

describe('GalleryPage', () => {
  it('renders session photos', () => {
    render(<GalleryPage />);
    expect(screen.getByText('Casamento João')).toBeTruthy();
    expect(screen.getByText('Cabine Salão')).toBeTruthy();
  });

  it('shows photo count badge', () => {
    render(<GalleryPage />);
    expect(screen.getByText('2 fotos')).toBeTruthy();
  });
});
