import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PixPaymentResponse } from '@packages/shared';
import { Printer } from 'lucide-react';

interface DeliveryScreenProps {
  sessionId: string;
  photoUrl: string;
  digitalPrice: number | null;
  brandName: string | null;
  onDone: () => void;
}

type Phase = 'printing' | 'upsell' | 'upsell-qr' | 'free-download';

const DOWNLOAD_URL_BASE = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const COUNTDOWN_SECONDS = 15;

export const DeliveryScreen: React.FC<DeliveryScreenProps> = ({
  sessionId,
  photoUrl,
  digitalPrice,
  brandName,
  onDone,
}) => {
  const [phase, setPhase] = useState<Phase>('printing');
  const [digitalPayment, setDigitalPayment] = useState<PixPaymentResponse | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // 1. Fire print IPC immediately
  useEffect(() => {
    try {
      (window as any).electronAPI?.printPhoto(photoUrl);
    } catch {
      // Electron API not available in dev/test — ignore
    }
  }, [photoUrl]);

  // 2. After 2.5s animation → move to next phase
  useEffect(() => {
    const timer = setTimeout(() => {
      if (digitalPrice && digitalPrice > 0) {
        setPhase('upsell');
      } else {
        setPhase('free-download');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [digitalPrice]);

  // 3. Countdown for free-download phase
  useEffect(() => {
    if (phase !== 'free-download') return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { onDone(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, onDone]);

  // 4. Request upsell PIX
  const requestUpsell = useCallback(async () => {
    try {
      const res = await axios.post<PixPaymentResponse>(`${API_URL}/payments/digital/${sessionId}`);
      setDigitalPayment(res.data);
      setPhase('upsell-qr');
    } catch {
      // Failed to create digital payment — skip upsell
      onDone();
    }
  }, [sessionId, onDone]);

  // 5. Poll payment status when in upsell-qr phase
  useEffect(() => {
    if (phase !== 'upsell-qr' || !digitalPayment) return;
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/payments/${digitalPayment.paymentId}`);
        if (res.data.status === 'APPROVED') {
          clearInterval(poll);
          // Show confirmed state for 5s then done
          setTimeout(onDone, 5000);
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [phase, digitalPayment, onDone]);

  const downloadUrl = `${DOWNLOAD_URL_BASE}/p/${sessionId}`;

  // ── PHASE: printing ────────────────────────────────────────────────────
  if (phase === 'printing') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8">
        {/* Photo preview — main content while printing */}
        {photoUrl && (
          <div
            className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10"
            style={{ maxHeight: '65vh', maxWidth: '80vw' }}
          >
            <img
              src={photoUrl}
              alt="Sua foto"
              className="block max-h-[65vh] max-w-[80vw] object-contain"
            />
          </div>
        )}

        {/* Printing status */}
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-white/70 text-xl font-medium flex items-center gap-2">
            <Printer size={20} />
            Imprimindo sua foto...
          </span>
        </div>
      </div>
    );
  }

  // ── PHASE: free-download ───────────────────────────────────────────────
  if (phase === 'free-download') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8 text-center">
        <h2 className="text-4xl font-bold text-white">Sua foto está pronta!</h2>

        {/* QR Code pointing to /p/:sessionId */}
        <div className="bg-white p-4 rounded-2xl shadow-2xl">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`}
            alt="QR Code download"
            className="w-48 h-48"
          />
        </div>

        <div>
          <p className="text-white/70 text-xl">Escaneie para baixar sua foto digital</p>
          {brandName && <p className="text-white/40 text-base mt-2">{brandName}</p>}
        </div>

        <p className="text-white/30 text-base">
          Voltando ao início em {countdown}s...
        </p>
      </div>
    );
  }

  // ── PHASE: upsell ──────────────────────────────────────────────────────
  if (phase === 'upsell') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8 text-center">
        <h2 className="text-4xl font-bold text-white">Quer sua foto no celular?</h2>
        <p className="text-7xl font-black text-white">
          {digitalPrice!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="text-white/60 text-xl">Pague com PIX e receba no celular</p>

        <button
          onClick={requestUpsell}
          className="bg-primary text-white text-xl font-bold px-12 py-5 rounded-2xl shadow-lg shadow-primary/40 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Quero minha foto digital
        </button>

        <button
          onClick={onDone}
          className="text-white/30 hover:text-white/60 text-base font-medium transition-colors py-2 px-6"
        >
          Não, obrigado
        </button>
      </div>
    );
  }

  // ── PHASE: upsell-qr ──────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8 text-center">
      <h2 className="text-3xl font-bold text-white">Escaneie para pagar</h2>

      {digitalPayment ? (
        <div className="bg-white p-4 rounded-2xl shadow-2xl">
          <img
            src={`data:image/png;base64,${digitalPayment.qrCodeBase64}`}
            alt="QR Code PIX Digital"
            className="w-56 h-56"
          />
        </div>
      ) : (
        <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
      )}

      <p className="text-white/50 text-base">Aguardando pagamento...</p>

      <button
        onClick={onDone}
        className="text-white/30 hover:text-white/60 text-sm font-medium transition-colors py-2 px-6"
      >
        Cancelar
      </button>
    </div>
  );
};
