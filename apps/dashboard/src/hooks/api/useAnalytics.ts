import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { IAnalyticsData } from '@packages/shared';

export const useAnalytics = (
  period: '7d' | '30d' | '90d' = '30d',
  from?: string,
  to?: string,
) =>
  useQuery<IAnalyticsData>({
    queryKey: ['analytics', period, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await api.get(`/tenant/analytics?${params.toString()}`);
      return data;
    },
  });
