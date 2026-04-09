import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { PaginatedResponse, IPaymentRecord } from '@packages/shared';

export const usePayments = (page = 1, limit = 20) =>
  useQuery<PaginatedResponse<IPaymentRecord>>({
    queryKey: ['payments', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/tenant/payments', { params: { page, limit } });
      return data;
    },
  });
