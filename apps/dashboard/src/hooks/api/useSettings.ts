import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { ITenantSettings, UpdateTenantSettingsDto, ChangePasswordDto } from '@packages/shared';

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

export const useUploadLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/tenant/settings/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as { logoUrl: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: async (dto: ChangePasswordDto) => {
      await api.post('/auth/change-password', dto);
    },
  });

export const useConnectMp = () =>
  useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ url: string }>('/auth/mp/connect');
      window.location.href = data.url;
    },
  });

export const useDisconnectMp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete('/tenant/settings/mp');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};
