import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { value: '1', label: 'Opção 1' },
  { value: '2', label: 'Opção 2' },
];

describe('Select', () => {
  it('renders options', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Opção 1')).toBeTruthy();
    expect(screen.getByText('Opção 2')).toBeTruthy();
  });

  it('renders placeholder', () => {
    render(<Select options={options} placeholder="Selecione..." />);
    expect(screen.getByText('Selecione...')).toBeTruthy();
  });

  it('shows error message', () => {
    render(<Select options={options} error="Campo obrigatório" />);
    expect(screen.getByText('Campo obrigatório')).toBeTruthy();
  });

  it('renders label', () => {
    render(<Select options={options} label="Tipo" />);
    expect(screen.getByText('Tipo')).toBeTruthy();
  });
});
