import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByText('Salvar')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Clique</Button>);
    fireEvent.click(screen.getByText('Clique'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('is disabled when loading=true', () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled=true', () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const fn = vi.fn();
    render(<Button disabled onClick={fn}>Salvar</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).not.toHaveBeenCalled();
  });
});
