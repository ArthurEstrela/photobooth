import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import jsQR from 'jsqr';

interface Props {
  onPaired: (creds: { boothId: string; boothToken: string }) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PairingScreen: React.FC<Props> = ({ onPaired }) => {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const handleCode = useCallback(async (code: string) => {
    if (loading) return;
    setScanning(false);
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_URL}/booths/pair`, {
        code: code.toUpperCase().trim(),
      });
      await onPaired({ boothId: data.boothId, boothToken: data.token });
    } catch {
      setError('Código inválido ou expirado. Gere um novo no painel.');
      setScanning(true);
    } finally {
      setLoading(false);
    }
  }, [loading, onPaired]);

  useEffect(() => {
    if (mode !== 'scan') return;

    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      // No camera API available (e.g., test environment) — stay in scan UI but skip camera
      return () => { active = false; };
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => { if (active) setMode('manual'); });

    const tick = () => {
      if (!active || !scanning) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imageData.data, imageData.width, imageData.height);
          if (qr?.data) { handleCode(qr.data); return; }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode, scanning, handleCode]);

  const handleManualSubmit = () => {
    if (manualCode.trim().length === 6) handleCode(manualCode);
  };

  const toggleMode = () => {
    setMode((m) => (m === 'scan' ? 'manual' : 'scan'));
    setError(null);
    setManualCode('');
    setScanning(true);
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-950 gap-8 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-white text-2xl font-bold">Pareamento de Cabine</h1>
        <p className="text-white/50 text-sm">
          Gere um código no painel e escaneie o QR abaixo.
        </p>
      </div>

      {mode === 'scan' ? (
        <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-2 border-white/20">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-4 border-2 border-primary rounded-xl pointer-events-none" />
        </div>
      ) : (
        <div className="space-y-3 w-72">
          <input
            className="w-full bg-white/10 text-white text-center text-2xl font-mono tracking-[0.4em] rounded-2xl px-4 py-4 border border-white/20 focus:outline-none focus:border-primary uppercase"
            placeholder="AB3K7X"
            maxLength={6}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          />
          <button
            aria-label="parear"
            onClick={handleManualSubmit}
            disabled={loading || manualCode.trim().length < 6}
            className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-40 text-white rounded-2xl font-semibold transition-opacity"
          >
            {loading ? 'Pareando...' : 'Parear'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>
      )}

      <button onClick={toggleMode} className="text-white/40 text-sm hover:text-white/70 transition-colors">
        {mode === 'scan' ? 'Digitar manualmente' : 'Escanear QR Code'}
      </button>
    </div>
  );
};
