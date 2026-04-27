import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw } from 'lucide-react';

interface Props {
  boothId: string;
  code: string;
  expiresAt: string;
  onClose: () => void;
  onRegenerate: () => void;
}

export const PairingModal: React.FC<Props> = ({ code, expiresAt, onClose, onRegenerate }) => {
  const [secsLeft, setSecsLeft] = useState(0);

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSecsLeft(calc());
    const timer = setInterval(() => setSecsLeft(calc()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const expired = secsLeft === 0;
  const mins = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const secs = String(secsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Parear Cabine</p>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className={`flex justify-center ${expired ? 'opacity-30' : ''}`}>
          <QRCodeSVG value={code} size={180} />
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400">Ou digite manualmente no totem</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-gray-900">{code}</p>
        </div>

        {expired ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-red-500 font-medium">Código expirado. Regenere.</p>
            <button
              onClick={onRegenerate}
              className="flex items-center gap-2 mx-auto text-sm text-primary font-medium hover:opacity-80"
            >
              <RefreshCw size={14} /> Regenerar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Expira em</span>
            <span className="font-mono font-medium text-gray-700">{mins}:{secs}</span>
          </div>
        )}
      </div>
    </div>
  );
};
