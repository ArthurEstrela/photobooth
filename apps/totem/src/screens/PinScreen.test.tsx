import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PinScreen } from './PinScreen';

// SHA-256 of "1234" computed via crypto.subtle
// In tests, we mock it for simplicity
const CORRECT_PIN_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';

vi.stubGlobal('crypto', {
  subtle: {
    digest: vi.fn(async (_algo: string, data: BufferSource) => {
      const text = new TextDecoder().decode(data);
      // For testing, we'll just return the mock hash as bytes
      // In reality, this would be the actual SHA-256 digest
      let hashString = '';
      if (text === '1234') {
        hashString = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      } else if (text === '0000') {
        hashString = '5feceb66ffc86f38d952786c6d696c79c2dbc238c4cafb11f2271d7db7d7495e';
      }
      // Convert hex string to bytes
      const bytes = new Uint8Array(hashString.length / 2);
      for (let i = 0; i < hashString.length; i += 2) {
        bytes[i / 2] = parseInt(hashString.substr(i, 2), 16);
      }
      return bytes.buffer;
    }),
  },
});

describe('PinScreen', () => {
  it('renders numeric keypad', () => {
    render(<PinScreen pinHash={CORRECT_PIN_HASH} onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('calls onClose when X is pressed', async () => {
    const onClose = vi.fn();
    render(<PinScreen pinHash={CORRECT_PIN_HASH} onSuccess={vi.fn()} onClose={onClose} />);
    const closeButton = screen.getByLabelText('Fechar');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSuccess with correct PIN', async () => {
    const onSuccess = vi.fn();
    render(<PinScreen pinHash={CORRECT_PIN_HASH} onSuccess={onSuccess} onClose={vi.fn()} />);
    // Type 1234 - auto-submits when 4 digits are reached
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    await waitFor(
      () => expect(onSuccess).toHaveBeenCalledOnce(),
      { timeout: 3000 }
    );
  });

  it('shows error and resets after 3 wrong attempts', async () => {
    const onClose = vi.fn();
    // Use a different hash so "1234" will be wrong
    const wrongHash = '5feceb66ffc86f38d952786c6d696c79c2dbc238c4cafb11f2271d7db7d7495e';
    render(<PinScreen pinHash={wrongHash} onSuccess={vi.fn()} onClose={onClose} />);
    for (let attempt = 0; attempt < 3; attempt++) {
      fireEvent.click(screen.getByText('1'));
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('3'));
      fireEvent.click(screen.getByText('4'));
      await waitFor(() => {}, { timeout: 500 });
    }
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1000 });
  });
});
