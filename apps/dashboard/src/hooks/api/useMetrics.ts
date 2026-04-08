// apps/dashboard/src/hooks/api/useMetrics.ts

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { TenantMetrics } from '../../../../packages/shared/src/types';

export const useMetrics = () => {
  return useQuery<TenantMetrics>({
    queryKey: ['metrics'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/metrics');
      return data;
    },
    // Refresh every 30 seconds for real-time feel
    refetchInterval: 30000,
  });
};
