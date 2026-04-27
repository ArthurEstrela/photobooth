import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PairingModal } from './PairingModal';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr">{value}</div>,
}));

describe('PairingModal', () => {
  const onClose = vi.fn();
  const expiresAt = new Date(Date.now() + 1800000).toISOString();

  it('renders the pairing code in large text', () => {
    render(
      <PairingModal
        code="AB3K7X"
        expiresAt={expiresAt}
        onClose={onClose}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getAllByText('AB3K7X').length).toBeGreaterThan(0);
  });

  it('renders a QR code with the pairing code as value', () => {
    render(
      <PairingModal
        code="AB3K7X"
        expiresAt={expiresAt}
        onClose={onClose}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByTestId('qr').textContent).toBe('AB3K7X');
  });

  it('shows expired state when expiresAt is in the past', () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    render(
      <PairingModal
        code="AB3K7X"
        expiresAt={pastExpiry}
        onClose={onClose}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByText(/expirado/i)).toBeTruthy();
  });
});
