import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { CountdownOverlay } from './CountdownOverlay';

describe('CountdownOverlay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the initial count', () => {
    render(<CountdownOverlay startCount={3} onComplete={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('counts down from 3 to 1 over 2 seconds', async () => {
    render(<CountdownOverlay startCount={3} onComplete={vi.fn()} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('2')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onComplete after countdown finishes', () => {
    const onComplete = vi.fn();
    render(<CountdownOverlay startCount={3} onComplete={onComplete} />);

    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(300));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
