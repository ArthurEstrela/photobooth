import React from 'react';
import { TrendingUp, Camera, Monitor, Target } from 'lucide-react';
import { Card, Badge, Skeleton } from '../components/ui';
import { useMetrics } from '../hooks/api/useMetrics';
import { useAnalytics } from '../hooks/api/useAnalytics';
import { useDashboardSocket } from '../hooks/useDashboardSocket';
import {
  ResponsiveContainer, LineChart, Line,
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export const Home: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics('30d');
  const { recentPayments } = useDashboardSocket();

  const kpiCards = [
    {
      label: 'Faturamento Total',
      icon: TrendingUp,
      value: metrics ? formatCurrency(metrics.totalRevenue) : '—',
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Sessões de Fotos',
      icon: Camera,
      value: metrics ? String(metrics.totalSessions) : '—',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Cabines Online',
      icon: Monitor,
      value: metrics ? String(metrics.activeBooths) : '—',
      color: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Taxa de Conversão',
      icon: Target,
      value: metrics ? `${metrics.conversionRate}%` : '—',
      color: 'text-violet-600 bg-violet-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-500 mt-0.5">Últimos 30 dias</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, icon: Icon, value, color }) => (
          <Card key={label} padding="md">
            {metricsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${color}`}>
                  <Icon size={18} />
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Charts — desktop side by side, mobile: scroll snap */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory md:overflow-visible">
        {/* Revenue Chart */}
        <div className="snap-start shrink-0 w-[90vw] md:w-auto md:flex-1">
          <Card padding="md">
            <p className="text-sm font-semibold text-gray-700 mb-4">Faturamento (30d)</p>
            {analyticsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatDate} />
                  <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Sessions Chart */}
        <div className="snap-start shrink-0 w-[90vw] md:w-auto md:flex-1">
          <Card padding="md">
            <p className="text-sm font-semibold text-gray-700 mb-4">Sessões por dia (30d)</p>
            {analyticsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={formatDate} />
                  <Bar dataKey="sessions" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </div>

      {/* Activity Feed */}
      <Card padding="md">
        <p className="text-sm font-semibold text-gray-700 mb-4">Atividade recente</p>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma atividade recente.</p>
        ) : (
          <div className="space-y-3">
            {recentPayments.slice(0, 5).map((p: any) => (
              <div key={p.paymentId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.eventName ?? 'Pagamento'}</p>
                  <p className="text-xs text-gray-400">{p.boothName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
                  <Badge variant="success">Aprovado</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
