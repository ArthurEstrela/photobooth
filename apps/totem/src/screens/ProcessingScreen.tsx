import React from 'react';

interface ProcessingScreenProps {
  photoCount: number;
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ photoCount }) => {
  const message = photoCount === 1
    ? 'Preparando sua foto...'
    : 'Montando sua tira de fotos...';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8">
      {/* Elegant spinner */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-t-primary/40 animate-spin"
          style={{ animationDuration: '1.4s', animationDirection: 'reverse' }}
        />
      </div>

      <p className="text-white text-2xl font-semibold tracking-wide">{message}</p>
    </div>
  );
};
