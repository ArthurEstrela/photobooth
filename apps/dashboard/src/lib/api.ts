// apps/dashboard/src/lib/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

// For development simplicity, let's inject a tenantId if not present
// In a real app, this would be handled by auth/context
api.interceptors.request.use((config) => {
  const url = new URL(config.url || '', config.baseURL);
  if (!url.searchParams.has('tenantId')) {
    config.params = { ...config.params, tenantId: localStorage.getItem('tenantId') || '' };
  }
  return config;
});

export default api;
