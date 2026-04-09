import React from 'react';
import { useMetrics } from '../hooks/api/useMetrics';
import { TrendingUp, Users, DollarSign, Camera } from 'lucide-react';

const MetricCard = ({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  loading: boolean;
}) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
    </div>
    {loading ? (
      <div className="h-8 w-24 bg-gray-100 animate-pulse rounded"></div>
    ) : (
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    )}
    <p className="text-sm text-gray-500 font-medium mt-1">{title}</p>
  </div>
);

export const Home: React.FC = () => {
  const { data: metrics, isLoading } = useMetrics();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Visão Geral</h2>
        <p className="text-gray-500">Bem-vindo ao seu painel de controle.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Faturamento Total"
          value={
            metrics?.totalRevenue != null
              ? `R$ ${Number(metrics.totalRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : 'R$ 0,00'
          }
          icon={DollarSign}
          color="bg-blue-600"
          loading={isLoading}
        />
        <MetricCard
          title="Sessões de Fotos"
          value={metrics?.totalSessions ?? 0}
          icon={Camera}
          color="bg-purple-600"
          loading={isLoading}
        />
        <MetricCard
          title="Cabines Online"
          value={metrics?.activeBooths ?? 0}
          icon={Users}
          color="bg-orange-600"
          loading={isLoading}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={metrics?.conversionRate != null ? `${metrics.conversionRate}%` : '0%'}
          icon={TrendingUp}
          color="bg-green-600"
          loading={isLoading}
        />
      </div>
    </div>
  );
};
