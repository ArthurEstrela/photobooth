import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nenhum resultado" />);
    expect(screen.getByText('Nenhum resultado')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Vazio" description="Adicione algo para começar" />);
    expect(screen.getByText('Adicione algo para começar')).toBeTruthy();
  });

  it('renders action button and fires callback', () => {
    const fn = vi.fn();
    render(<EmptyState title="Vazio" action={{ label: 'Criar', onClick: fn }} />);
    fireEvent.click(screen.getByText('Criar'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not render action button when no action provided', () => {
    render(<EmptyState title="Vazio" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
