import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { ITemplate, IEventTemplate } from '@packages/shared';

export const useTemplates = () =>
  useQuery<ITemplate[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/templates');
      return data;
    },
  });

export const useUploadTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const form = new FormData();
      form.append('name', name);
      form.append('file', file);
      const { data } = await api.post('/tenant/templates', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as ITemplate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tenant/templates/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
};

export const useEventTemplates = (eventId: string | null) =>
  useQuery<IEventTemplate[]>({
    queryKey: ['event-templates', eventId],
    queryFn: async () => {
      const { data } = await api.get(`/tenant/events/${eventId}/templates`);
      return data;
    },
    enabled: !!eventId,
  });

export const useSetEventTemplates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, templateIds }: { eventId: string; templateIds: string[] }) => {
      const { data } = await api.put(`/tenant/events/${eventId}/templates`, { templateIds });
      return data as IEventTemplate[];
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['event-templates', vars.eventId] });
    },
  });
};
