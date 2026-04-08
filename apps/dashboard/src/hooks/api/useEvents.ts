// apps/dashboard/src/hooks/api/useEvents.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { IEvent as Event } from '@packages/shared';

export const useEvents = () => {
  return useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await api.get('/events');
      return data;
    },
  });
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newEvent: Partial<Event>) => {
      const { data } = await api.post('/events', newEvent);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Event> & { id: string }) => {
      const { data: updatedData } = await api.put(`/events/${id}`, data);
      return updatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};
