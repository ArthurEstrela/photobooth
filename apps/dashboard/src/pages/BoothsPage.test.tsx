import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoothsPage } from './BoothsPage';

vi.mock('../hooks/api/useBooths', () => ({
  useBooths: () => ({
    data: [
      { id: 'b-1', name: 'Cabine Salão', isOnline: true, token: 'tok-1', offlineMode: 'BLOCK' },
      { id: 'b-2', name: 'Cabine Jardim', isOnline: false, token: 'tok-2', offlineMode: 'DEMO' },
    ],
    isLoading: false,
  }),
  useCreateBooth: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('BoothsPage', () => {
  it('renders list of booths with online/offline badges', () => {
    render(<BoothsPage />);
    expect(screen.getByText('Cabine Salão')).toBeTruthy();
    expect(screen.getByText('Cabine Jardim')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows create modal when "Nova Cabine" is clicked', async () => {
    render(<BoothsPage />);
    fireEvent.click(screen.getByText('Nova Cabine'));
    await waitFor(() => {
      expect(screen.getByText('Cadastrar Nova Cabine')).toBeTruthy();
    });
  });
});
