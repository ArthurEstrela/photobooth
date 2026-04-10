import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { IBoothWithStatus, OfflineMode } from '@packages/shared';

export const useBooths = () =>
  useQuery<IBoothWithStatus[]>({
    queryKey: ['booths'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/booths');
      return data;
    },
  });

export const useCreateBooth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; offlineMode?: OfflineMode }) => {
      const { data } = await api.post('/tenant/booths', body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booths'] }),
  });
};

export const useSetBoothEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ boothId, eventId }: { boothId: string; eventId: string | null }) => {
      const { data } = await api.put(`/tenant/booths/${boothId}/event`, { eventId });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booths'] }),
  });
};
