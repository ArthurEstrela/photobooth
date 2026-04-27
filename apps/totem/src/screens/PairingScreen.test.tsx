import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PairingScreen } from './PairingScreen';
import axios from 'axios';

vi.mock('axios');
const mockOnPaired = vi.fn();

describe('PairingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders QR scan mode by default with toggle button', () => {
    render(<PairingScreen onPaired={mockOnPaired} />);
    expect(screen.getByText(/pareamento/i)).toBeTruthy();
    expect(screen.getByText(/digitar manualmente/i)).toBeTruthy();
  });

  it('switches to manual input mode on toggle click', () => {
    render(<PairingScreen onPaired={mockOnPaired} />);
    fireEvent.click(screen.getByText(/digitar manualmente/i));
    expect(screen.getByPlaceholderText(/AB3K7X/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /parear/i })).toBeTruthy();
  });

  it('calls API and invokes onPaired with credentials on success', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { boothId: 'b-1', token: 'jwt-abc' },
    });

    render(<PairingScreen onPaired={mockOnPaired} />);
    fireEvent.click(screen.getByText(/digitar manualmente/i));

    const input = screen.getByPlaceholderText(/AB3K7X/i);
    fireEvent.change(input, { target: { value: 'AB3K7X' } });
    fireEvent.click(screen.getByRole('button', { name: /parear/i }));

    await waitFor(() => {
      expect(mockOnPaired).toHaveBeenCalledWith({ boothId: 'b-1', boothToken: 'jwt-abc' });
    });
  });

  it('shows error message on invalid code (404)', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { status: 404 } });

    render(<PairingScreen onPaired={mockOnPaired} />);
    fireEvent.click(screen.getByText(/digitar manualmente/i));

    const input = screen.getByPlaceholderText(/AB3K7X/i);
    fireEvent.change(input, { target: { value: 'BADCOD' } });
    fireEvent.click(screen.getByRole('button', { name: /parear/i }));

    await waitFor(() => {
      expect(screen.getByText(/inválido ou expirado/i)).toBeTruthy();
    });
    expect(mockOnPaired).not.toHaveBeenCalled();
  });
});
