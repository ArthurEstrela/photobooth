import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

const mockDisconnectMp = vi.fn();
const mockConnectMp = vi.fn();

vi.mock('../hooks/api/useSettings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false, isError: false, reset: vi.fn() }),
  useConnectMp: () => ({ mutate: mockConnectMp, isPending: false }),
  useDisconnectMp: () => ({ mutate: mockDisconnectMp, isPending: false }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@test.com' }, logout: vi.fn() }),
}));

import { useSettings } from '../hooks/api/useSettings';

const baseSettings = {
  logoUrl: null,
  primaryColor: '#4f46e5',
  brandName: 'MyBrand',
  mp: { connected: false, email: null, connectedAt: null },
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({
      data: baseSettings,
      isLoading: false,
    } as any);
    mockDisconnectMp.mockReset();
    mockConnectMp.mockReset();
  });

  it('renders brand name input with current value', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('MyBrand')).toBeTruthy();
  });

  it('renders color picker input with current color', () => {
    render(<SettingsPage />);
    const inputs = screen.getAllByDisplayValue('#4f46e5');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows MP section with connect button when not connected', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Mercado Pago')).toBeTruthy();
    expect(screen.getByText('Conectar Mercado Pago')).toBeTruthy();
  });

  it('shows connected state with email and disconnect button', () => {
    vi.mocked(useSettings).mockReturnValue({
      data: {
        ...baseSettings,
        mp: { connected: true, email: 'owner@mp.com', connectedAt: new Date('2026-01-01') },
      },
      isLoading: false,
    } as any);
    render(<SettingsPage />);
    expect(screen.getByText('owner@mp.com')).toBeTruthy();
    expect(screen.getByText('Desconectar')).toBeTruthy();
  });

  it('calls disconnectMp when disconnect button is clicked', async () => {
    vi.mocked(useSettings).mockReturnValue({
      data: {
        ...baseSettings,
        mp: { connected: true, email: 'owner@mp.com', connectedAt: new Date() },
      },
      isLoading: false,
    } as any);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Desconectar'));
    await waitFor(() => expect(mockDisconnectMp).toHaveBeenCalled());
  });
});
