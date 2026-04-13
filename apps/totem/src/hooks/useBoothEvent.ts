import { useState, useEffect } from 'react';
import axios from 'axios';
import { BoothEventResponseDto } from '@packages/shared';

type BoothEvent = BoothEventResponseDto['event'];
type BoothTemplate = BoothEventResponseDto['templates'][number];

export function useBoothEvent(boothId: string, token: string) {
  const [event, setEvent] = useState<BoothEvent | null>(null);
  const [templates, setTemplates] = useState<BoothTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    axios
      .get<BoothEventResponseDto>(`${apiUrl}/booths/${boothId}/event`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => {
        setEvent(res.data.event);
        setTemplates(res.data.templates);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError('Failed to load event');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [boothId, token]);

  return { event, templates, isLoading, error };
}
