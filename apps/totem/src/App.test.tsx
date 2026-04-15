import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useBoothConfig', () => ({
  useBoothConfig: () => ({
    config: { branding: { brandName: 'TestBooth', logoUrl: null, primaryColor: '#1d4ed8' }, offlineMode: 'BLOCK', offlineCredits: 0, demoSessionsPerHour: 3, cameraSound: true },
  }),
}));

vi.mock('./hooks/useBoothEvent', () => ({
  useBoothEvent: () => ({
    event: { id: 'ev-1', name: 'Wedding', price: 30, photoCount: 1, digitalPrice: null, backgroundUrl: null, maxTemplates: 3 },
    templates: [{ id: 't-1', name: 'Frame 1', overlayUrl: '', order: 0 }],
    isLoading: false,
  }),
}));

vi.mock('./hooks/useBoothMachine', () => ({
  useBoothMachine: () => ({
    state: 'IDLE',
    currentPayment: null,
    sessionId: null,
    socketRef: { current: null },
    startPayment: vi.fn(),
    completeSession: vi.fn(),
  }),
}));

vi.mock('./hooks/useWebcam', () => ({
  useWebcam: () => ({ videoRef: { current: null }, error: null, isLoading: false }),
}));

vi.mock('./hooks/useDeviceConfig', () => ({
  useDeviceConfig: () => ({
    deviceConfig: { selectedCamera: null, selectedPrinter: null, maintenancePinHash: null },
    setDeviceConfig: vi.fn(),
  }),
}));

vi.mock('./hooks/useDeviceHeartbeat', () => ({
  useDeviceHeartbeat: vi.fn(),
}));

describe('App — IDLE state', () => {
  it('renders brand name in idle screen', () => {
    render(<App />);
    expect(screen.getByText('TestBooth')).toBeTruthy();
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });
});
