import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('../hooks/api/useAnalytics', () => ({
  useAnalytics: () => ({
    data: {
      series: [],
      totalRevenue: 2500,
      avgTicket: 30,
      bestDay: { date: '2026-04-01', revenue: 300 },
      mostActiveBooth: { name: 'Cabine Principal', sessions: 10 },
      topEvents: [{ id: 'ev-1', name: 'Wedding', revenue: 1000 }],
    },
    isLoading: false,
  }),
}));

describe('AnalyticsPage', () => {
  it('renders period selector buttons', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('7 dias')).toBeTruthy();
    expect(screen.getByText('30 dias')).toBeTruthy();
    expect(screen.getByText('90 dias')).toBeTruthy();
  });

  it('renders summary cards with correct values', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText(/R\$ 2.500,00/)).toBeTruthy();
    expect(screen.getByText(/Cabine Principal/)).toBeTruthy();
  });

  it('renders top events table', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
  });
});
