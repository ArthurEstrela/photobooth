import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Printer, CheckCircle } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { DeviceConfig } from '../hooks/useDeviceConfig';

interface Props {
  boothId: string;
  socketRef: React.MutableRefObject<Socket | null>;
  deviceConfig: DeviceConfig;
  setDeviceConfig: (partial: Partial<DeviceConfig>) => void;
  onClose: () => void;
}

export const MaintenanceScreen: React.FC<Props> = ({
  boothId,
  socketRef,
  deviceConfig,
  setDeviceConfig,
  onClose,
}) => {
  const [cameras, setCameras] = useState<string[]>([]);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(deviceConfig.selectedCamera ?? '');
  const [selectedPrinter, setSelectedPrinter] = useState(deviceConfig.selectedPrinter ?? '');
  const [saved, setSaved] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Detect cameras
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => d.label || d.deviceId);
      setCameras(cams);
    }).catch(() => setCameras([]));

    // Detect printers via Electron IPC
    const totemAPI = (window as any).totemAPI;
    if (totemAPI?.getPrinters) {
      totemAPI.getPrinters().then((list: Array<{ name: string }>) => {
        setPrinters(list.map((p) => p.name));
      }).catch(() => setPrinters([]));
    }
  }, []);

  const handleTestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPreviewStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
      }, 3000);
    } catch {
      // camera access denied
    }
  };

  const handleTestPrinter = () => {
    const totemAPI = (window as any).totemAPI;
    totemAPI?.printPhoto?.();
  };

  const handleSave = () => {
    setDeviceConfig({ selectedCamera: selectedCamera || null, selectedPrinter: selectedPrinter || null });
    socketRef.current?.emit('hardware_updated', {
      boothId,
      selectedCamera: selectedCamera || null,
      selectedPrinter: selectedPrinter || null,
    });
    setSaved(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl p-8 w-96 flex flex-col gap-6 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-white font-bold text-xl">🔧 Manutenção</p>
          <button
            aria-label="Fechar manutenção"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera */}
        <div className="space-y-2">
          <label className="text-white/70 text-sm font-medium flex items-center gap-2">
            <Camera size={14} /> Câmera
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm border border-white/10 focus:outline-none focus:border-primary"
          >
            <option value="">Selecione uma câmera</option>
            {cameras.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleTestCamera}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Testar Câmera
          </button>
          {previewStream && (
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full rounded-xl mt-2 aspect-video object-cover"
            />
          )}
        </div>

        {/* Printer */}
        <div className="space-y-2">
          <label className="text-white/70 text-sm font-medium flex items-center gap-2">
            <Printer size={14} /> Impressora
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm border border-white/10 focus:outline-none focus:border-primary"
          >
            <option value="">Selecione uma impressora</option>
            {printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={handleTestPrinter}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Testar Impressora
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saved}
          className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-60 text-white rounded-2xl font-semibold text-sm transition-opacity flex items-center justify-center gap-2"
        >
          {saved ? (
            <><CheckCircle size={16} /> Salvo!</>
          ) : (
            'Salvar e Voltar'
          )}
        </button>
      </div>
    </div>
  );
};
