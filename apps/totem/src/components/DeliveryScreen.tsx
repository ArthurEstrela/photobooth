import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  sessionId: string;
  brandName?: string | null;
}

const DeliveryScreen: React.FC<Props> = ({ sessionId, brandName }) => {
  const cloudUrl = `${import.meta.env.VITE_PUBLIC_URL ?? 'https://photobooth.app'}/p/${sessionId}`;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-8 p-12">
      <h1 className="text-6xl font-black tracking-tight">Obrigado! 📸</h1>

      <p className="text-2xl text-white/70 text-center max-w-lg">
        Sua foto está sendo impressa e enviada para a nuvem.
      </p>

      <div className="bg-white p-6 rounded-3xl shadow-2xl">
        <QRCodeSVG value={cloudUrl} size={220} level="H" includeMargin={false} />
      </div>

      <p className="text-white/50 text-lg text-center">
        Escaneie para baixar sua foto digital
      </p>

      {brandName && (
        <p className="text-[color:var(--color-primary)] font-bold text-xl">{brandName}</p>
      )}

      <div className="text-white/30 text-base animate-pulse">Voltando ao início em instantes...</div>
    </div>
  );
};

export default DeliveryScreen;
