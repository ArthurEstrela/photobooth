import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceConfig } from './useDeviceConfig';

describe('useDeviceConfig', () => {
  beforeEach(() => localStorage.clear());

  it('returns null values when localStorage is empty', () => {
    const { result } = renderHook(() => useDeviceConfig());
    expect(result.current.deviceConfig.selectedCamera).toBeNull();
    expect(result.current.deviceConfig.selectedPrinter).toBeNull();
    expect(result.current.deviceConfig.maintenancePinHash).toBeNull();
  });

  it('persists and reads back config', () => {
    const { result } = renderHook(() => useDeviceConfig());
    act(() => {
      result.current.setDeviceConfig({
        selectedCamera: 'Logitech C920',
        selectedPrinter: 'DNP RX1',
        maintenancePinHash: 'abc',
      });
    });
    expect(result.current.deviceConfig.selectedCamera).toBe('Logitech C920');
    expect(result.current.deviceConfig.selectedPrinter).toBe('DNP RX1');
  });

  it('merges partial updates', () => {
    const { result } = renderHook(() => useDeviceConfig());
    act(() => result.current.setDeviceConfig({ selectedCamera: 'C920' }));
    act(() => result.current.setDeviceConfig({ selectedPrinter: 'DNP' }));
    expect(result.current.deviceConfig.selectedCamera).toBe('C920');
    expect(result.current.deviceConfig.selectedPrinter).toBe('DNP');
  });
});
