import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { IEvent } from '@packages/shared';

export const useEvents = () =>
  useQuery<IEvent[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await api.get('/events');
      return data;
    },
  });

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      price: number;
      photoCount: number;
      digitalPrice?: number | null;
      backgroundUrl?: string | null;
      maxTemplates?: number;
    }) => {
      const { data } = await api.post('/events', body);
      return data as IEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string;
      name: string;
      price: number;
      photoCount: number;
      digitalPrice?: number | null;
      backgroundUrl?: string | null;
      maxTemplates?: number;
    }) => {
      const { data } = await api.put(`/events/${id}`, body);
      return data as IEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/events/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};
