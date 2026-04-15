import React, { useRef, useCallback } from 'react';

interface IdleScreenProps {
  brandName: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  eventLoading: boolean;
  hasEvent: boolean;
  hasTemplates: boolean;
  onTap: () => void;
  onSecretTap?: () => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({
  brandName,
  logoUrl,
  backgroundUrl,
  eventLoading,
  hasEvent,
  hasTemplates,
  onTap,
  onSecretTap,
}) => {
  const tapCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 3000);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      clearTimeout(resetTimerRef.current!);
      onSecretTap?.();
    }
  }, [onSecretTap]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ backgroundColor: backgroundUrl ? 'transparent' : '#0f0f0f' }}
    >
      {/* Secret tap zone — invisible, top-left corner */}
      <div
        data-testid="secret-tap-zone"
        onClick={handleSecretTap}
        className="absolute top-0 left-0 w-[100px] h-[100px] z-20"
        style={{ opacity: 0 }}
      />

      {/* Background image */}
      {backgroundUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        {logoUrl && (
          <img src={logoUrl} alt="logo" className="h-24 object-contain drop-shadow-lg" />
        )}

        <h1 className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-lg">
          {brandName ?? 'PhotoBooth'}
        </h1>

        {eventLoading ? (
          <p className="text-2xl text-white/60 font-medium">Carregando evento...</p>
        ) : !hasEvent ? (
          <p className="text-2xl text-white/40 font-medium">Cabine não vinculada a um evento</p>
        ) : !hasTemplates ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-amber-400/80 font-medium">Evento sem molduras</p>
            <p className="text-base text-white/50">Vincule pelo menos uma moldura no Dashboard</p>
          </div>
        ) : (
          <button
            onClick={onTap}
            className="group mt-4 flex flex-col items-center gap-4 focus:outline-none"
            aria-label="Iniciar sessão"
          >
            <div className="w-8 h-8 rounded-full bg-primary animate-ping opacity-80" />
            <p className="text-2xl text-white/70 font-medium group-hover:text-white transition-colors">
              Toque para começar
            </p>
          </button>
        )}
      </div>
    </div>
  );
};
