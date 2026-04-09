import React, { useState } from 'react';
import { usePayments } from '../hooks/api/usePayments';
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { IPaymentRecord } from '@packages/shared';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'APROVADO', className: 'bg-green-100 text-green-700' },
  PENDING: { label: 'PENDENTE', className: 'bg-yellow-100 text-yellow-700' },
  EXPIRED: { label: 'EXPIRADO', className: 'bg-gray-100 text-gray-500' },
  REJECTED: { label: 'REJEITADO', className: 'bg-red-100 text-red-700' },
};

function exportToCsv(payments: IPaymentRecord[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = 'Data,Evento,Cabine,Valor,Status';
  const rows = payments.map((p) =>
    [
      new Date(p.createdAt).toLocaleDateString('pt-BR'),
      escape(p.eventName),
      escape(p.boothName),
      `R$ ${p.amount.toFixed(2)}`,
      p.status,
    ].join(','),
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pagamentos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const PaymentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = usePayments(page, 20);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pagamentos</h2>
          <p className="text-gray-500">Histórico de todas as transações.</p>
        </div>
        <button
          onClick={() => data && exportToCsv(data.data)}
          disabled={!data || data.data.length === 0}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-64 text-red-500">
          <p>Erro ao carregar pagamentos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Data', 'Evento', 'Cabine', 'Valor', 'Status'].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.data.map((payment) => {
                const status = STATUS_LABELS[payment.status] ?? { label: payment.status, className: 'bg-gray-100 text-gray-500' };
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(payment.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{payment.eventName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.boothName}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      R$ {payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data && data.total > data.limit && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">{data.total} transações no total</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600">Página {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(data.total / data.limit)}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
