import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import * as useSettingsModule from '../hooks/api/useSettings';

vi.mock('../hooks/api/useSettings', () => ({
  useSettings: vi.fn().mockReturnValue({
    data: { logoUrl: null, primaryColor: '#1d4ed8', brandName: 'MyBrand' },
    isLoading: false,
  }),
  useUpdateSettings: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  }),
}));

describe('SettingsPage', () => {
  it('renders form with current settings values', () => {
    render(<SettingsPage />);
    const brandInput = screen.getByDisplayValue('MyBrand');
    expect(brandInput).toBeTruthy();
  });

  it('calls mutate on form submit', () => {
    const mockMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useSettingsModule.useUpdateSettings).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
    } as any);

    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Salvar Configurações'));
    expect(mockMutate).toHaveBeenCalled();
  });
});
