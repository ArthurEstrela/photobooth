import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingPage } from './BillingPage';

vi.mock('../hooks/api/useBilling', () => ({
  useBilling: () => ({
    data: {
      status: 'ACTIVE',
      pricePerBooth: 200,
      boothCount: 3,
      billingAnchorDay: 15,
      invoice: null,
    },
    isLoading: false,
  }),
}));

describe('BillingPage', () => {
  it('renders billing page heading', () => {
    render(<BillingPage />);
    expect(screen.getByText('Assinatura')).toBeTruthy();
  });

  it('shows booth count and price per booth', () => {
    render(<BillingPage />);
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText(/200/)).toBeTruthy();
  });

  it('shows next billing day', () => {
    render(<BillingPage />);
    expect(screen.getByText(/15/)).toBeTruthy();
  });
});
