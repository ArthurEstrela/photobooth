import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BoothsPage } from './BoothsPage';

vi.mock('../hooks/api/useBooths', () => ({
  useBooths: () => ({
    data: [
      { id: 'b-1', name: 'Cabine Salão', isOnline: true, offlineMode: 'BLOCK', activeEventId: 'ev-1', activeEvent: { id: 'ev-1', name: 'Wedding' } },
      { id: 'b-2', name: 'Cabine Jardim', isOnline: false, offlineMode: 'DEMO', activeEventId: null, activeEvent: null },
    ],
    isLoading: false,
  }),
  useCreateBooth: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
  useSetBoothEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateBoothDevices: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/api/useEvents', () => ({
  useEvents: () => ({
    data: [{ id: 'ev-1', name: 'Wedding', price: 30 }],
    isLoading: false,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('BoothsPage', () => {
  it('renders booth cards with online/offline badges', () => {
    renderWithClient(<BoothsPage />);
    expect(screen.getByText('Cabine Salão')).toBeTruthy();
    expect(screen.getByText('Cabine Jardim')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows active event name on booth card', () => {
    renderWithClient(<BoothsPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
  });

  it('opens drawer when "Configurar" is clicked', async () => {
    renderWithClient(<BoothsPage />);
    fireEvent.click(screen.getAllByText('Configurar')[0]);
    await waitFor(() => {
      expect(screen.getByText('Configurar Cabine')).toBeTruthy();
    });
  });

  it('shows create form when "Nova Cabine" is clicked', async () => {
    renderWithClient(<BoothsPage />);
    fireEvent.click(screen.getByText('Nova Cabine'));
    await waitFor(() => {
      expect(screen.getByText('Cadastrar Cabine')).toBeTruthy();
    });
  });
});
