import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from './Home';

vi.mock('../hooks/api/useMetrics', () => ({
  useMetrics: () => ({
    data: { totalRevenue: 1500, totalSessions: 42, activeBooths: 3, conversionRate: 75 },
    isLoading: false,
  }),
}));

vi.mock('../hooks/api/useAnalytics', () => ({
  useAnalytics: () => ({ data: { series: [], topEvents: [], totalRevenue: 1500, avgTicket: 35.7, bestDay: null, mostActiveBooth: null }, isLoading: false }),
}));

vi.mock('../hooks/useDashboardSocket', () => ({
  useDashboardSocket: () => ({ recentPayments: [] }),
}));

// Mock Recharts because it uses ResizeObserver which might not be available in test env
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div />,
  Line: () => <div />,
  BarChart: () => <div />,
  Bar: () => <div />,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

describe('Home', () => {
  it('renders all 4 KPI cards', () => {
    render(<Home />);
    expect(screen.getByText('Faturamento Total')).toBeTruthy();
    expect(screen.getByText('Sessões de Fotos')).toBeTruthy();
    expect(screen.getByText('Cabines Online')).toBeTruthy();
    expect(screen.getByText('Taxa de Conversão')).toBeTruthy();
  });

  it('displays formatted revenue', () => {
    render(<Home />);
    expect(screen.getByText('R$ 1.500,00')).toBeTruthy();
  });
});
