import { useEffect, useRef, MutableRefObject } from 'react';
import { Socket } from 'socket.io-client';
import { DeviceHeartbeatEvent } from '@packages/shared';
import { DeviceConfig } from './useDeviceConfig';

const HEARTBEAT_INTERVAL_MS = 30_000;

async function buildHeartbeat(
  boothId: string,
  deviceConfig: DeviceConfig,
): Promise<DeviceHeartbeatEvent> {
  // Detect cameras via browser API
  let cameras: string[] = [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => d.label || d.deviceId);
  } catch {
    cameras = [];
  }

  // Detect printers via Electron IPC
  let printers: string[] = [];
  try {
    const totemAPI = (window as any).totemAPI;
    if (totemAPI?.getPrinters) {
      const list: Array<{ name: string }> = await totemAPI.getPrinters();
      printers = list.map((p) => p.name);
    }
  } catch {
    printers = [];
  }

  return {
    boothId,
    cameras,
    printers,
    selectedCamera: deviceConfig.selectedCamera,
    selectedPrinter: deviceConfig.selectedPrinter,
  };
}

export function useDeviceHeartbeat(
  socketRef: MutableRefObject<Socket | null>,
  boothId: string,
  deviceConfig: DeviceConfig,
) {
  const deviceConfigRef = useRef(deviceConfig);
  deviceConfigRef.current = deviceConfig;

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    async function emit() {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      const payload = await buildHeartbeat(boothId, deviceConfigRef.current);
      socket.emit('device_heartbeat', payload);
    }

    // Emit immediately when socket connects
    function onConnect() {
      emit();
    }

    function setup() {
      const socket = socketRef.current;
      if (!socket) return;
      socket.on('connect', onConnect);
      // Also emit now if already connected
      if (socket.connected) emit();
      intervalId = setInterval(emit, HEARTBEAT_INTERVAL_MS);
    }

    // Try to attach immediately; if socket not ready yet, wait 100ms
    const setupTimeout = setTimeout(setup, 100);

    return () => {
      clearTimeout(setupTimeout);
      clearInterval(intervalId);
      socketRef.current?.off('connect', onConnect);
    };
  }, [boothId, socketRef]);
}
