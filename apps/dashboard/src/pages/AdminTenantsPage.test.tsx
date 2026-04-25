import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminTenantsPage } from './AdminTenantsPage';

const mockStartImpersonation = vi.fn();
const mockImpersonateMutate = vi.fn();

vi.mock('../hooks/api/useAdmin', () => ({
  useAdminTenants: () => ({
    data: [
      { id: 't1', name: 'Foto Express', email: 'foto@express.com', createdAt: '2026-01-01T00:00:00.000Z', mpConnected: true, boothCount: 3 },
      { id: 't2', name: 'Studio XYZ', email: 'studio@xyz.com', createdAt: '2026-02-01T00:00:00.000Z', mpConnected: false, boothCount: 1 },
    ],
    isLoading: false,
  }),
  useImpersonate: () => ({ mutate: mockImpersonateMutate, isPending: false }),
}));

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminToken: 'admin-token',
    adminEmail: 'admin@photobooth.com',
    adminLogout: vi.fn(),
    startImpersonation: mockStartImpersonation,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('AdminTenantsPage', () => {
  beforeEach(() => {
    mockStartImpersonation.mockReset();
    mockImpersonateMutate.mockReset();
  });

  it('renders tenant rows', () => {
    render(<AdminTenantsPage />);
    expect(screen.getByText('Foto Express')).toBeTruthy();
    expect(screen.getByText('Studio XYZ')).toBeTruthy();
  });

  it('shows MP connected indicator', () => {
    render(<AdminTenantsPage />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Não conectado')).toBeTruthy();
  });

  it('calls useImpersonate mutate when "Entrar como" is clicked', async () => {
    render(<AdminTenantsPage />);
    const buttons = screen.getAllByRole('button', { name: /entrar como/i });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(mockImpersonateMutate).toHaveBeenCalled());
  });
});
