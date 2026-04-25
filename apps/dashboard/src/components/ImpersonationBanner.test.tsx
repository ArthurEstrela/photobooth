import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImpersonationBanner } from './ImpersonationBanner';

const mockStopImpersonation = vi.fn();

const mockAdminAuthState = {
  isImpersonating: true,
  impersonatedEmail: 'tenant@example.com',
  stopImpersonation: mockStopImpersonation,
};

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => mockAdminAuthState,
}));

describe('ImpersonationBanner', () => {
  it('shows impersonated email', () => {
    render(<ImpersonationBanner />);
    expect(screen.getByText(/tenant@example.com/)).toBeTruthy();
  });

  it('calls stopImpersonation when exit button is clicked', () => {
    render(<ImpersonationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(mockStopImpersonation).toHaveBeenCalled();
  });

  it('renders nothing when not impersonating', () => {
    mockAdminAuthState.isImpersonating = false;
    const { container } = render(<ImpersonationBanner />);
    expect(container.firstChild).toBeNull();
    mockAdminAuthState.isImpersonating = true;
  });
});
