import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { ITenantSettings, UpdateTenantSettingsDto } from '@packages/shared';

export const useSettings = () =>
  useQuery<ITenantSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/settings');
      return data;
    },
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateTenantSettingsDto) => {
      const { data } = await api.put('/tenant/settings', body);
      return data as ITenantSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};
