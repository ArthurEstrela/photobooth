import React, { useState } from 'react';
import { TrendingUp, Calendar, Monitor, Zap } from 'lucide-react';
import { Card, Button, Skeleton } from '../components/ui';
import { useAnalytics } from '../hooks/api/useAnalytics';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const PERIODS = [
  { label: '7 dias',  value: '7d'  as const },
  { label: '30 dias', value: '30d' as const },
  { label: '90 dias', value: '90d' as const },
];

export const AnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { data, isLoading } = useAnalytics(period);

  const summaryCards = data ? [
    { label: 'Faturamento total',   icon: TrendingUp, value: formatCurrency(data.totalRevenue) },
    { label: 'Ticket médio',        icon: Zap,        value: formatCurrency(data.avgTicket) },
    { label: 'Melhor dia',          icon: Calendar,   value: data.bestDay ? `${formatDate(data.bestDay.date)} · ${formatCurrency(data.bestDay.revenue)}` : '—' },
    { label: 'Cabine mais ativa',   icon: Monitor,    value: data.mostActiveBooth ? `${data.mostActiveBooth.name} (${data.mostActiveBooth.sessions} sessões)` : '—' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? [1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          : summaryCards.map(({ label, icon: Icon, value }) => (
            <Card key={label} padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-light text-primary rounded-xl">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
                </div>
              </div>
            </Card>
          ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-4">Faturamento acumulado</p>
          {isLoading ? <Skeleton className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: any) => formatCurrency(v as number)} labelFormatter={formatDate as any} />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-4">Sessões por dia</p>
          {isLoading ? <Skeleton className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={formatDate as any} />
                <Bar dataKey="sessions" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Top Events */}
      <Card padding="md">
        <p className="text-sm font-semibold text-gray-700 mb-4">Top 5 eventos por faturamento</p>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : !data?.topEvents.length ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum evento no período.</p>
        ) : (
          <div className="space-y-2">
            {data.topEvents.map((ev, i) => (
              <div key={ev.id} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-gray-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{ev.name}</span>
                    <span className="text-sm font-bold text-gray-900 ml-2">{formatCurrency(ev.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(ev.revenue / data.topEvents[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
