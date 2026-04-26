import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, Skeleton } from '../components/ui';
import { useBilling } from '../hooks/api/useBilling';

const STATUS_CONFIG = {
  ACTIVE: { label: 'Ativa', icon: CheckCircle, color: 'text-green-600' },
  SUSPENDED: { label: 'Suspensa', icon: AlertCircle, color: 'text-red-600' },
  TRIAL: { label: 'Trial', icon: Clock, color: 'text-amber-600' },
};

export const BillingPage: React.FC = () => {
  const { data: billing, isLoading } = useBilling();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!billing) return null;

  const statusCfg = STATUS_CONFIG[billing.status];
  const StatusIcon = statusCfg.icon;
  const nextAmount = billing.boothCount * billing.pricePerBooth;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Assinatura</h1>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Status</p>
          <span className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.color}`}>
            <StatusIcon size={15} />
            {statusCfg.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div>
            <p className="text-xs text-gray-400">Cabines ativas</p>
            <p className="text-2xl font-bold text-gray-900">{billing.boothCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Preço/cabine</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {billing.pricePerBooth.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Próximo vencimento</p>
            <p className="text-2xl font-bold text-gray-900">Dia {billing.billingAnchorDay}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Próxima cobrança prevista:{' '}
            <span className="font-medium text-gray-900">
              R$ {nextAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </Card>

      {billing.invoice && (
        <Card padding="md" className="space-y-3">
          <p className="font-semibold text-gray-900">Fatura pendente</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Valor</span>
            <span className="font-medium text-gray-900">
              R$ {billing.invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Vencimento</span>
            <span className="font-medium text-gray-900">
              {new Date(billing.invoice.dueDate).toLocaleDateString('pt-BR')}
            </span>
          </div>
          {billing.invoice.qrCodeBase64 && (
            <div className="flex justify-center pt-2">
              <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <img
                  src={`data:image/png;base64,${billing.invoice.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-40 h-40"
                />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
