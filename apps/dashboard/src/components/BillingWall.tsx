import React from 'react';
import { Lock } from 'lucide-react';
import { useBilling } from '../hooks/api/useBilling';

export const BillingWall: React.FC = () => {
  const { data: billing, isLoading } = useBilling({ poll: true });

  if (isLoading || !billing || billing.status !== 'SUSPENDED') return null;

  const { invoice, boothCount, pricePerBooth } = billing;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
            <Lock size={28} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Assinatura Suspensa</h1>
          <p className="text-white/60 text-sm">
            Escaneie o QR Code para regularizar e liberar o sistema imediatamente.
          </p>
        </div>

        {invoice?.qrCodeBase64 ? (
          <div className="bg-white p-4 rounded-2xl shadow-2xl inline-block mx-auto">
            <img
              src={`data:image/png;base64,${invoice.qrCodeBase64}`}
              alt="QR Code PIX Assinatura"
              className="w-48 h-48"
            />
          </div>
        ) : (
          <div className="w-56 h-56 bg-white/10 rounded-2xl flex items-center justify-center mx-auto">
            <p className="text-white/40 text-sm">QR Code em geração...</p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-white text-xl font-bold">
            R$ {invoice?.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '—'}
          </p>
          <p className="text-white/40 text-xs">
            {boothCount} cabine(s) × R$ {pricePerBooth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {invoice?.dueDate && (
            <p className="text-white/40 text-xs">
              Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        <p className="text-white/30 text-xs flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Aguardando confirmação do pagamento...
        </p>
      </div>
    </div>
  );
};
