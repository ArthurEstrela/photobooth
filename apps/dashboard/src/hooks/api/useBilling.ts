import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface BillingInvoice {
  id: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE';
  qrCode: string | null;
  qrCodeBase64: string | null;
}

export interface BillingStatus {
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  pricePerBooth: number;
  boothCount: number;
  billingAnchorDay: number;
  invoice: BillingInvoice | null;
}

export const useBilling = (options?: { poll?: boolean }) =>
  useQuery<BillingStatus>({
    queryKey: ['billing'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/billing');
      return data;
    },
    refetchInterval: options?.poll ? 5000 : false,
  });
