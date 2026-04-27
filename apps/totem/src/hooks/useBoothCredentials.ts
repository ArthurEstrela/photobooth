import { useState, useEffect, useCallback } from 'react';

interface Credentials {
  boothId: string;
  boothToken: string;
}

interface UseBoothCredentials {
  boothId: string | null;
  boothToken: string | null;
  isLoading: boolean;
  setCredentials: (creds: Credentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
}

export function useBoothCredentials(): UseBoothCredentials {
  const [boothId, setBoothId] = useState<string | null>(null);
  const [boothToken, setBoothToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const api = (window as any).totemAPI;
    if (!api?.getCredentials) {
      setIsLoading(false);
      return;
    }
    api.getCredentials().then((creds: Credentials | null) => {
      if (creds) {
        setBoothId(creds.boothId);
        setBoothToken(creds.boothToken);
      }
      setIsLoading(false);
    });
  }, []);

  const setCredentials = useCallback(async (creds: Credentials) => {
    const api = (window as any).totemAPI;
    await api?.setCredentials(creds);
    setBoothId(creds.boothId);
    setBoothToken(creds.boothToken);
  }, []);

  const clearCredentials = useCallback(async () => {
    const api = (window as any).totemAPI;
    await api?.clearCredentials();
    setBoothId(null);
    setBoothToken(null);
  }, []);

  return { boothId, boothToken, isLoading, setCredentials, clearCredentials };
}
