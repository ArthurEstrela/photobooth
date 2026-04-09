import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { TemplateSelector } from './components/TemplateSelector';
import { CameraEngine } from './components/CameraEngine';
import DeliveryScreen from './components/DeliveryScreen';

const BOOTH_ID = import.meta.env.VITE_BOOTH_ID ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

export default function App() {
  const { videoRef } = useWebcam();
  const { config } = useBoothConfig(BOOTH_ID, BOOTH_TOKEN);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config);

  const [isSelectingTemplate, setIsSelectingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (machine.state === BoothState.IDLE) {
      setIsSelectingTemplate(false);
      setSelectedTemplateId('');
    }
  }, [machine.state]);

  const handleIdleTap = () => {
    if (machine.state === BoothState.IDLE && !eventLoading && templates.length > 0) {
      setIsSelectingTemplate(true);
    }
  };

  const handleConfirmTemplate = () => {
    if (!event || !selectedTemplateId) return;
    setIsSelectingTemplate(false);
    machine.startPayment(event.id, selectedTemplateId, event.price);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      {/* IDLE */}
      {machine.state === BoothState.IDLE && !isSelectingTemplate && (
        <div
          className="flex flex-col items-center justify-center h-full text-white cursor-pointer select-none gap-6"
          onClick={handleIdleTap}
        >
          {config?.branding.logoUrl && (
            <img src={config.branding.logoUrl} alt="logo" className="h-24 object-contain" />
          )}
          <h1 className="text-7xl font-black tracking-tighter">
            {config?.branding.brandName ?? 'PhotoBooth'}
          </h1>
          <p className="text-2xl text-white/60">
            {eventLoading ? 'Carregando...' : 'Toque para começar'}
          </p>
          {!eventLoading && templates.length > 0 && (
            <div
              className="mt-4 w-6 h-6 rounded-full animate-ping"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
          )}
        </div>
      )}

      {/* SELECTING_TEMPLATE */}
      {machine.state === BoothState.IDLE && isSelectingTemplate && (
        <TemplateSelector
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onConfirm={handleConfirmTemplate}
          videoRef={videoRef}
        />
      )}

      {/* WAITING_PAYMENT */}
      {machine.state === BoothState.WAITING_PAYMENT && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-8 p-12">
          <h2 className="text-4xl font-bold">Escaneie para pagar</h2>
          {machine.currentPayment ? (
            <>
              <div className="bg-white p-6 rounded-3xl shadow-2xl">
                <img
                  src={`data:image/png;base64,${machine.currentPayment.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-white/50 text-xl font-mono">{machine.currentPayment.qrCode}</p>
            </>
          ) : (
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* IN_SESSION / COUNTDOWN / CAPTURING */}
      {(machine.state === BoothState.IN_SESSION ||
        machine.state === BoothState.COUNTDOWN ||
        machine.state === BoothState.CAPTURING) && (
        <CameraEngine
          overlayUrl={selectedTemplate?.overlayUrl}
          sessionId={machine.sessionId ?? 'session'}
          photoCount={event?.photoCount ?? 1}
          cameraSound={config?.cameraSound ?? true}
          onStripReady={(strip) => machine.completeSession(strip)}
        />
      )}

      {/* PROCESSING */}
      {machine.state === BoothState.PROCESSING && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-6">
          <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-3xl font-semibold">Processando sua foto...</p>
        </div>
      )}

      {/* DELIVERY */}
      {machine.state === BoothState.DELIVERY && (
        <DeliveryScreen
          sessionId={machine.sessionId ?? 'session'}
          brandName={config?.branding.brandName}
        />
      )}
    </div>
  );
}
