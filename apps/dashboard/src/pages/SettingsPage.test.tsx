import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

vi.mock('../hooks/api/useSettings', () => ({
  useSettings: () => ({
    data: { logoUrl: null, primaryColor: '#4f46e5', brandName: 'MyBrand' },
    isLoading: false,
  }),
  useUpdateSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false, isError: false, reset: vi.fn() }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@test.com' }, logout: vi.fn() }),
}));

describe('SettingsPage', () => {
  it('renders brand name input with current value', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('MyBrand')).toBeTruthy();
  });

  it('renders color picker input with current color', () => {
    render(<SettingsPage />);
    const inputs = screen.getAllByDisplayValue('#4f46e5');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows logo upload area', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Enviar logo')).toBeTruthy();
  });
});
