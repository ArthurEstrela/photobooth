import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@test.com' }, logout: vi.fn() }),
}));

describe('DashboardLayout', () => {
  it('renders nav items on desktop sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <DashboardLayout><div>Content</div></DashboardLayout>
      </MemoryRouter>
    );
    expect(screen.getAllByText('Início').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cabines').length).toBeGreaterThan(0);
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('marks active route with text-primary class', () => {
    render(
      <MemoryRouter initialEntries={['/booths']}>
        <DashboardLayout><div /></DashboardLayout>
      </MemoryRouter>
    );
    const links = screen.getAllByText('Cabines');
    const activeLink = links.find((el) => el.closest('a')?.className.includes('text-primary'));
    expect(activeLink).toBeTruthy();
  });
});
