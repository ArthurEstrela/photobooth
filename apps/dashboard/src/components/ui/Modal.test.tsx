import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Teste">
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.getByText('Conteúdo')).toBeTruthy();
    expect(screen.getByText('Teste')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Teste">
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.queryByText('Conteúdo')).toBeNull();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Teste">
        <p>Conteúdo</p>
      </Modal>
    );
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
