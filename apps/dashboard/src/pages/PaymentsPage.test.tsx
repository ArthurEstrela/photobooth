import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentsPage } from './PaymentsPage';

const mockPayments = {
  data: [
    {
      id: 'pay-1',
      amount: 15,
      status: 'APPROVED',
      eventName: 'Casamento João',
      boothName: 'Cabine Salão',
      createdAt: new Date('2026-01-15').toISOString(),
    },
    {
      id: 'pay-2',
      amount: 15,
      status: 'EXPIRED',
      eventName: 'Casamento João',
      boothName: 'Cabine Salão',
      createdAt: new Date('2026-01-15').toISOString(),
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
};

vi.mock('../hooks/api/usePayments', () => ({
  usePayments: () => ({ data: mockPayments, isLoading: false }),
}));

global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

describe('PaymentsPage', () => {
  it('renders payment rows', () => {
    render(<PaymentsPage />);
    expect(screen.getAllByText('Casamento João').length).toBeGreaterThan(0);
  });

  it('shows APPROVED status badge', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('APROVADO')).toBeTruthy();
    expect(screen.getByText('EXPIRADO')).toBeTruthy();
  });

  it('renders export CSV button', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('Exportar CSV')).toBeTruthy();
  });
});
