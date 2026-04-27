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

const LS_KEY = 'booth_credentials';

function lsGet(): Credentials | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(creds: Credentials) {
  localStorage.setItem(LS_KEY, JSON.stringify(creds));
}

function lsClear() {
  localStorage.removeItem(LS_KEY);
}

export function useBoothCredentials(): UseBoothCredentials {
  const [boothId, setBoothId] = useState<string | null>(null);
  const [boothToken, setBoothToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const api = (window as any).totemAPI;
    if (!api?.getCredentials) {
      // Fallback: localStorage (browser dev mode without Electron)
      const creds = lsGet();
      if (creds) {
        setBoothId(creds.boothId);
        setBoothToken(creds.boothToken);
      }
      setIsLoading(false);
      return;
    }
    api.getCredentials()
      .then((creds: Credentials | null) => {
        if (creds) {
          setBoothId(creds.boothId);
          setBoothToken(creds.boothToken);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setCredentials = useCallback(async (creds: Credentials) => {
    const api = (window as any).totemAPI;
    if (api?.setCredentials) {
      await api.setCredentials(creds);
    } else {
      lsSet(creds);
    }
    setBoothId(creds.boothId);
    setBoothToken(creds.boothToken);
  }, []);

  const clearCredentials = useCallback(async () => {
    const api = (window as any).totemAPI;
    if (api?.clearCredentials) {
      await api.clearCredentials();
    } else {
      lsClear();
    }
    setBoothId(null);
    setBoothToken(null);
  }, []);

  return { boothId, boothToken, isLoading, setCredentials, clearCredentials };
}
