import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface AdminTenant {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  mpConnected: boolean;
  boothCount: number;
}

function adminAxios() {
  const token = localStorage.getItem('admin_token');
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const useAdminTenants = () =>
  useQuery<AdminTenant[]>({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const { data } = await adminAxios().get('/admin/tenants');
      return data;
    },
  });

export const useImpersonate = () =>
  useMutation({
    mutationFn: async (tenantId: string) => {
      const { data } = await adminAxios().post(`/admin/impersonate/${tenantId}`);
      return data as { token: string; tenantId: string; email: string };
    },
  });
