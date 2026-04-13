import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { PixPaymentResponse } from '@packages/shared';

interface PaymentScreenProps {
  amount: number;
  payment: PixPaymentResponse | null;
  onCancel: () => void;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CircularTimer({ expiresIn }: { expiresIn: number }) {
  const [remaining, setRemaining] = useState(expiresIn);

  useEffect(() => {
    setRemaining(expiresIn);
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  const pct = remaining / expiresIn;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" className="absolute -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke="rgb(var(--color-primary-rgb, 79 70 229))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="text-white text-xs font-mono font-bold">
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  amount,
  payment,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!payment?.qrCode) return;
    navigator.clipboard.writeText(payment.qrCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 px-8 gap-8 text-center">
      {/* Amount */}
      <div>
        <p className="text-white/50 text-lg font-medium">Pague com PIX</p>
        <p className="text-6xl font-black text-white mt-2">{formatCurrency(amount)}</p>
      </div>

      {payment ? (
        <>
          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl shadow-2xl">
            <img
              src={`data:image/png;base64,${payment.qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-56 h-56 md:w-64 md:h-64"
            />
          </div>

          {/* Timer */}
          <CircularTimer expiresIn={payment.expiresIn} />

          {/* Pix code — tap to copy */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors max-w-sm w-full"
          >
            <span className="flex-1 text-white/50 text-xs font-mono truncate text-left">
              {payment.qrCode}
            </span>
            <span className="text-white/70 shrink-0">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </span>
          </button>
          {copied && <p className="text-green-400 text-sm -mt-4">Copiado!</p>}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
          <p className="text-white/50 text-lg">Gerando QR Code...</p>
        </div>
      )}

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="text-white/30 hover:text-white/60 text-base font-medium transition-colors py-2 px-6"
      >
        Cancelar
      </button>
    </div>
  );
};
