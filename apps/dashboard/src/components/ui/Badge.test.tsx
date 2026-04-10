import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders label', () => {
    render(<Badge variant="success">Online</Badge>);
    expect(screen.getByText('Online')).toBeTruthy();
  });

  it('applies success styles', () => {
    render(<Badge variant="success">Online</Badge>);
    const el = screen.getByText('Online');
    expect(el.className).toContain('green');
  });

  it('applies neutral styles', () => {
    render(<Badge variant="neutral">Offline</Badge>);
    const el = screen.getByText('Offline');
    expect(el.className).toContain('gray');
  });
});
