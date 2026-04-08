import { useState, useEffect } from 'react';
import axios from 'axios';
import { BoothConfigDto } from '@packages/shared';

export function useBoothConfig(boothId: string, token: string) {
  const [config, setConfig] = useState<BoothConfigDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    axios
      .get<BoothConfigDto>(`${apiUrl}/booths/${boothId}/config`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => {
        setConfig(res.data);
        if (res.data.branding.primaryColor) {
          document.documentElement.style.setProperty(
            '--color-primary',
            res.data.branding.primaryColor,
          );
        }
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError('Failed to load booth config');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [boothId, token]);

  return { config, isLoading, error };
}
