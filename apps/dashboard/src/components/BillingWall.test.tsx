import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingWall } from './BillingWall';

vi.mock('../hooks/api/useBilling', () => ({
  useBilling: vi.fn(),
}));

import { useBilling } from '../hooks/api/useBilling';

describe('BillingWall', () => {
  it('renders nothing when status is ACTIVE', () => {
    vi.mocked(useBilling).mockReturnValue({
      data: { status: 'ACTIVE', invoice: null, pricePerBooth: 200, boothCount: 2, billingAnchorDay: 15 },
      isLoading: false,
    } as any);
    const { container } = render(<BillingWall />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with QR code when status is SUSPENDED', () => {
    vi.mocked(useBilling).mockReturnValue({
      data: {
        status: 'SUSPENDED',
        pricePerBooth: 200,
        boothCount: 3,
        billingAnchorDay: 15,
        invoice: {
          id: 'inv-1',
          amount: 600,
          dueDate: '2026-05-22',
          status: 'OVERDUE',
          qrCode: 'qr-code-string',
          qrCodeBase64: 'base64string',
        },
      },
      isLoading: false,
    } as any);
    render(<BillingWall />);
    expect(screen.getByText(/assinatura suspensa/i)).toBeTruthy();
    expect(screen.getByText(/R\$\s*600/)).toBeTruthy();
  });

  it('renders overlay without amount when invoice is null', () => {
    vi.mocked(useBilling).mockReturnValue({
      data: {
        status: 'SUSPENDED',
        pricePerBooth: 200,
        boothCount: 3,
        billingAnchorDay: 15,
        invoice: null,
      },
      isLoading: false,
    } as any);
    render(<BillingWall />);
    expect(screen.getByText(/assinatura suspensa/i)).toBeTruthy();
    // Should NOT render "undefined"
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it('renders nothing when data is loading', () => {
    vi.mocked(useBilling).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<BillingWall />);
    expect(container.firstChild).toBeNull();
  });
});
