import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders single row with default height', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('animate-pulse');
  });

  it('renders multiple rows', () => {
    const { container } = render(<Skeleton rows={3} />);
    const wrapper = container.firstChild as HTMLElement;
    const rows = wrapper.querySelectorAll('div');
    expect(rows.length).toBe(3);
  });

  it('last row in multi-row is shorter', () => {
    const { container } = render(<Skeleton rows={3} />);
    const wrapper = container.firstChild as HTMLElement;
    const rows = Array.from(wrapper.querySelectorAll('div'));
    expect(rows[2].className).toContain('w-3/4');
    expect(rows[0].className).toContain('w-full');
  });
});
