import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { PaginatedResponse, IGallerySession } from '@packages/shared';

export const useGallery = (page = 1, limit = 20) =>
  useQuery<PaginatedResponse<IGallerySession>>({
    queryKey: ['gallery', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/tenant/photos', { params: { page, limit } });
      return data;
    },
  });
