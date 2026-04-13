import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { CameraEngine } from './components/CameraEngine';
import { IdleScreen } from './screens/IdleScreen';
import { FrameSelectionScreen } from './screens/FrameSelectionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';

const BOOTH_ID    = import.meta.env.VITE_BOOTH_ID    ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

/** Convert hex color to "r g b" RGB triplet string for CSS custom property */
function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function App() {
  const { videoRef } = useWebcam();
  const { config }   = useBoothConfig(BOOTH_ID, BOOTH_TOKEN);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config);

  const [isSelectingFrame, setIsSelectingFrame]   = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Apply white-label CSS variables whenever branding changes
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

  // Reset frame selection when returning to IDLE
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

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950">

      {/* ── IDLE ─────────────────────────────────────────────── */}
      {machine.state === BoothState.IDLE && !isSelectingFrame && (
        <IdleScreen
          brandName={config?.branding.brandName ?? null}
          logoUrl={config?.branding.logoUrl ?? null}
          backgroundUrl={event?.backgroundUrl ?? null}
          eventLoading={eventLoading}
          hasEvent={!!event && templates.length > 0}
          onTap={handleIdleTap}
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
          photoCount={(event?.photoCount ?? 1) as 1 | 2 | 4}
          cameraSound={config?.cameraSound ?? true}
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
          onDone={() => machine.resetToIdle()}
        />
      )}

    </div>
  );
}
