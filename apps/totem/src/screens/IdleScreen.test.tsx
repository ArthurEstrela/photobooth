import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdleScreen } from './IdleScreen';

describe('IdleScreen', () => {
  it('renders brand name', () => {
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('MyBooth')).toBeTruthy();
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });

  it('shows loading message when eventLoading', () => {
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading
        hasEvent={false}
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('Carregando evento...')).toBeTruthy();
  });

  it('shows "not configured" when no event and not loading', () => {
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent={false}
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('Cabine não configurada')).toBeTruthy();
  });

  it('calls onTap when tapped and has event', () => {
    const onTap = vi.fn();
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent
        onTap={onTap}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('does NOT call onTap when has no event', () => {
    const onTap = vi.fn();
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent={false}
        onTap={onTap}
      />
    );
    // No button rendered when no event
    expect(screen.queryByRole('button')).toBeNull();
  });
});
