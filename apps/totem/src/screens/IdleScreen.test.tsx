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
        hasTemplates
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
        hasTemplates={false}
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
        hasTemplates={false}
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('Cabine não vinculada a um evento')).toBeTruthy();
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
        hasTemplates
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
        hasTemplates={false}
        onTap={onTap}
      />
    );
    // No button rendered when no event
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onSecretTap after 5 taps in the secret zone within 3s', () => {
    vi.useFakeTimers();
    const onSecretTap = vi.fn();
    render(
      <IdleScreen
        brandName="Test"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent
        hasTemplates
        onTap={vi.fn()}
        onSecretTap={onSecretTap}
      />,
    );
    const zone = screen.getByTestId('secret-tap-zone');
    for (let i = 0; i < 5; i++) fireEvent.click(zone);
    expect(onSecretTap).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('resets tap count after 3s without completing 5 taps', () => {
    vi.useFakeTimers();
    const onSecretTap = vi.fn();
    render(
      <IdleScreen
        brandName="Test"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent
        hasTemplates
        onTap={vi.fn()}
        onSecretTap={onSecretTap}
      />,
    );
    const zone = screen.getByTestId('secret-tap-zone');
    fireEvent.click(zone);
    fireEvent.click(zone);
    vi.advanceTimersByTime(3100);
    fireEvent.click(zone);
    fireEvent.click(zone);
    fireEvent.click(zone);
    fireEvent.click(zone);
    fireEvent.click(zone);
    // Count reset after timeout, so only 5 new taps fire
    expect(onSecretTap).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
