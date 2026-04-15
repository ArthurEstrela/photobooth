import { useState, useCallback } from 'react';

const STORAGE_KEY = 'booth_device_config';

export interface DeviceConfig {
  selectedCamera: string | null;
  selectedPrinter: string | null;
  maintenancePinHash: string | null;
}

function readFromStorage(): DeviceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors
  }
  return { selectedCamera: null, selectedPrinter: null, maintenancePinHash: null };
}

export function useDeviceConfig() {
  const [deviceConfig, setConfigState] = useState<DeviceConfig>(readFromStorage);

  const setDeviceConfig = useCallback((partial: Partial<DeviceConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { deviceConfig, setDeviceConfig };
}
