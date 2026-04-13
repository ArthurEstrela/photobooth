import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentScreen } from './PaymentScreen';

const PAYMENT = {
  paymentId: 'pay-1',
  qrCode: 'pix-code-string',
  qrCodeBase64: 'aGVsbG8=',
  expiresIn: 120,
};

describe('PaymentScreen', () => {
  it('renders amount prominently', () => {
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={vi.fn()} />);
    expect(screen.getByText('R$ 30,00')).toBeTruthy();
  });

  it('shows pix code for copy', () => {
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={vi.fn()} />);
    expect(screen.getByText('pix-code-string')).toBeTruthy();
  });

  it('shows QR code image', () => {
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('base64');
  });

  it('calls onCancel when Cancelar is clicked', () => {
    const onCancel = vi.fn();
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows loading spinner when payment is null', () => {
    render(<PaymentScreen amount={30} payment={null} onCancel={vi.fn()} />);
    expect(screen.getByText('Gerando QR Code...')).toBeTruthy();
  });
});
