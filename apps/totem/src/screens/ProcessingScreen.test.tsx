import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessingScreen } from './ProcessingScreen';

describe('ProcessingScreen', () => {
  it('shows single-photo message for photoCount 1', () => {
    render(<ProcessingScreen photoCount={1} />);
    expect(screen.getByText('Preparando sua foto...')).toBeTruthy();
  });

  it('shows strip message for photoCount 4', () => {
    render(<ProcessingScreen photoCount={4} />);
    expect(screen.getByText('Montando sua tira de fotos...')).toBeTruthy();
  });
});
