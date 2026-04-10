import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Campo obrigatório" />);
    expect(screen.getByText('Campo obrigatório')).toBeTruthy();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows hint when no error', () => {
    render(<Input label="Email" hint="Exemplo: usuario@email.com" />);
    expect(screen.getByText('Exemplo: usuario@email.com')).toBeTruthy();
  });

  it('hides hint when error is present', () => {
    render(<Input label="Email" hint="Dica" error="Erro" />);
    expect(screen.queryByText('Dica')).toBeNull();
    expect(screen.getByText('Erro')).toBeTruthy();
  });

  it('is disabled when disabled prop passed', () => {
    render(<Input label="Email" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
