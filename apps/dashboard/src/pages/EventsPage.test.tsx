import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventsPage } from './EventsPage';

vi.mock('../hooks/api/useEvents', () => ({
  useEvents: () => ({
    data: [
      { id: 'ev-1', name: 'Wedding', price: 30, photoCount: 4, digitalPrice: 5, maxTemplates: 3, createdAt: new Date() },
    ],
    isLoading: false,
  }),
  useCreateEvent: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
  useUpdateEvent: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
  useDeleteEvent: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('EventsPage', () => {
  it('renders events table with name and price', () => {
    render(<EventsPage />);
    expect(screen.getAllByText('Wedding').length).toBeGreaterThan(0);
    // Use regex to handle potential non-breaking spaces in currency formatting
    expect(screen.getAllByText(/R\$.*30,00/).length).toBeGreaterThan(0);
  });

  it('opens create modal when "Novo Evento" is clicked', async () => {
    render(<EventsPage />);
    fireEvent.click(screen.getByText('Novo Evento'));
    await waitFor(() => expect(screen.getByText('Criar Evento')).toBeTruthy());
  });

  it('create modal has digitalPrice field', async () => {
    render(<EventsPage />);
    fireEvent.click(screen.getByText('Novo Evento'));
    await waitFor(() => expect(screen.getByLabelText('Preço do digital (R$)')).toBeTruthy());
  });
});
