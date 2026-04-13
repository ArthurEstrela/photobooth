import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FramesPage } from './FramesPage';

vi.mock('../hooks/api/useTemplates', () => ({
  useTemplates: () => ({
    data: [
      { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', tenantId: 'tenant-1', createdAt: new Date() },
    ],
    isLoading: false,
  }),
  useUploadTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTemplate: () => ({ mutate: vi.fn() }),
  useEventTemplates: () => ({ data: [], isLoading: false }),
  useSetEventTemplates: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/api/useEvents', () => ({
  useEvents: () => ({
    data: [{ id: 'ev-1', name: 'Wedding', maxTemplates: 3 }],
    isLoading: false,
  }),
}));

describe('FramesPage', () => {
  it('renders the pool column heading', () => {
    render(<FramesPage />);
    expect(screen.getByText('Pool de Molduras')).toBeTruthy();
  });

  it('renders the event column heading', () => {
    render(<FramesPage />);
    expect(screen.getByText('Molduras do Evento')).toBeTruthy();
  });

  it('shows existing template in pool', () => {
    render(<FramesPage />);
    expect(screen.getByText('Floral')).toBeTruthy();
  });

  it('shows "Adicionar Moldura" button', () => {
    render(<FramesPage />);
    expect(screen.getByText('Adicionar Moldura')).toBeTruthy();
  });
});
