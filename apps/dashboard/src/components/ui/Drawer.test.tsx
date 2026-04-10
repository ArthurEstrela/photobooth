import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders children when open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Config">
        <p>Conteúdo</p>
      </Drawer>
    );
    expect(screen.getByText('Conteúdo')).toBeTruthy();
    expect(screen.getByText('Config')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="Config">
        <p>Conteúdo</p>
      </Drawer>
    );
    expect(screen.queryByText('Conteúdo')).toBeNull();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Config">
        <p>Conteúdo</p>
      </Drawer>
    );
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
