import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { useDeviceConfig } from './hooks/useDeviceConfig';
import { useDeviceHeartbeat } from './hooks/useDeviceHeartbeat';
import { CameraEngine } from './components/CameraEngine';
import { IdleScreen } from './screens/IdleScreen';
import { FrameSelectionScreen } from './screens/FrameSelectionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';
import { PinScreen } from './screens/PinScreen';
import { MaintenanceScreen } from './screens/MaintenanceScreen';

const BOOTH_ID    = import.meta.env.VITE_BOOTH_ID    ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function App() {
  const { videoRef } = useWebcam();
  const { deviceConfig, setDeviceConfig } = useDeviceConfig();
  const { config }   = useBoothConfig(BOOTH_ID, BOOTH_TOKEN, setDeviceConfig);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config, setDeviceConfig);

  useDeviceHeartbeat(machine.socketRef, BOOTH_ID, deviceConfig);

  const isSuspended = config?.suspended === true;

  const [isSelectingFrame, setIsSelectingFrame]   = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showPin, setShowPin]                       = useState(false);
  const [showMaintenance, setShowMaintenance]       = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    const color = config?.branding.primaryColor;
    if (color) {
      try {
        document.documentElement.style.setProperty('--color-primary-rgb', hexToRgbString(color));
      } catch {
        // invalid color format — skip
      }
    }
  }, [config?.branding.primaryColor]);

  useEffect(() => {
    if (machine.state === BoothState.IDLE) {
      setIsSelectingFrame(false);
      setSelectedTemplateId('');
    }
  }, [machine.state]);

  const handleIdleTap = () => {
    if (!eventLoading && templates.length > 0) {
      setIsSelectingFrame(true);
    }
  };

  const handleConfirmFrame = () => {
    if (!event || !selectedTemplateId) return;
    setIsSelectingFrame(false);
    machine.startPayment(event.id, selectedTemplateId, event.price);
  };

  if (isSuspended) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950">
        <div className="text-center space-y-4 px-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="text-white text-xl font-semibold">Sistema Suspenso</p>
          <p className="text-white/50 text-sm">Entre em contato com o operador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950">

      {/* ── IDLE ─────────────────────────────────────────────── */}
      {machine.state === BoothState.IDLE && !isSelectingFrame && (
        <IdleScreen
          brandName={config?.branding.brandName ?? null}
          logoUrl={config?.branding.logoUrl ?? null}
          backgroundUrl={event?.backgroundUrl ?? null}
          eventLoading={eventLoading}
          hasEvent={!!event}
          hasTemplates={templates.length > 0}
          onTap={handleIdleTap}
          onSecretTap={() => setShowPin(true)}
        />
      )}

      {/* ── SELECTING FRAME ───────────────────────────────────── */}
      {machine.state === BoothState.IDLE && isSelectingFrame && (
        <FrameSelectionScreen
          templates={templates}
          selectedId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onConfirm={handleConfirmFrame}
          videoRef={videoRef}
        />
      )}

      {/* ── WAITING PAYMENT ───────────────────────────────────── */}
      {machine.state === BoothState.WAITING_PAYMENT && (
        <PaymentScreen
          amount={event?.price ?? 0}
          payment={machine.currentPayment ?? null}
          onCancel={() => machine.startPayment('', '', 0)}
        />
      )}

      {/* ── IN SESSION / COUNTDOWN / CAPTURING ───────────────── */}
      {(machine.state === BoothState.IN_SESSION ||
        machine.state === BoothState.COUNTDOWN ||
        machine.state === BoothState.CAPTURING) && (
        <CameraEngine
          overlayUrl={selectedTemplate?.overlayUrl}
          sessionId={machine.sessionId ?? 'session'}
          photoCount={(selectedTemplate?.photoCount ?? event?.photoCount ?? 1) as 1 | 2 | 4}
          layout={selectedTemplate?.layout}
          cameraSound={config?.cameraSound ?? true}
          onProcessing={() => machine.setProcessing()}
          onStripReady={(strip) => machine.completeSession(strip)}
        />
      )}

      {/* ── PROCESSING ────────────────────────────────────────── */}
      {machine.state === BoothState.PROCESSING && (
        <ProcessingScreen photoCount={event?.photoCount ?? 1} />
      )}

      {/* ── DELIVERY ──────────────────────────────────────────── */}
      {machine.state === BoothState.DELIVERY && (
        <DeliveryScreen
          sessionId={machine.sessionId ?? ''}
          photoUrl={machine.stripDataUrl}
          digitalPrice={event?.digitalPrice ?? null}
          brandName={config?.branding.brandName ?? null}
          onDone={() => {
            setIsSelectingFrame(false);
            setSelectedTemplateId('');
            machine.resetToIdle();
          }}
        />
      )}

      {/* ── MAINTENANCE OVERLAYS (z-50, above everything) ─────── */}
      {showPin && (
        <PinScreen
          pinHash={deviceConfig.maintenancePinHash}
          onSuccess={() => { setShowPin(false); setShowMaintenance(true); }}
          onClose={() => setShowPin(false)}
        />
      )}
      {showMaintenance && (
        <MaintenanceScreen
          boothId={BOOTH_ID}
          socketRef={machine.socketRef}
          deviceConfig={deviceConfig}
          setDeviceConfig={setDeviceConfig}
          onClose={() => setShowMaintenance(false)}
        />
      )}

    </div>
  );
}
