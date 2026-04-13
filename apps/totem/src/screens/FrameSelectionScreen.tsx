import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  overlayUrl: string;
  order: number;
}

interface FrameSelectionScreenProps {
  templates: Template[];
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const FrameSelectionScreen: React.FC<FrameSelectionScreenProps> = ({
  templates,
  selectedId,
  onSelect,
  onConfirm,
  videoRef,
}) => {
  // Portrait: 2 cols. Landscape: 3 cols.
  const gridClass = 'grid grid-cols-2 md:grid-cols-3 gap-4';

  return (
    <div className="w-full h-full flex flex-col bg-gray-950">
      {/* Live camera feed as background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover opacity-20 scale-x-[-1]"
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <h2 className="text-3xl font-bold text-white">Escolha sua moldura</h2>
          <p className="text-white/50 text-lg mt-1">Toque para selecionar</p>
        </div>

        {/* Templates grid */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className={gridClass}>
            {templates.map((t) => {
              const isSelected = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-4 transition-all focus:outline-none
                    ${isSelected
                      ? 'border-primary scale-[1.02] shadow-2xl shadow-primary/40'
                      : 'border-white/10 hover:border-white/30'
                    }`}
                >
                  {/* Live camera overlay preview */}
                  <div className="absolute inset-0 bg-gray-800" />
                  <img
                    src={t.overlayUrl}
                    alt={t.name}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-primary">
                      <CheckCircle2 size={28} fill="white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                    <p className="text-white text-sm font-semibold text-center truncate">{t.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-10 pt-4">
          <button
            onClick={onConfirm}
            disabled={!selectedId}
            className={`w-full py-5 rounded-2xl text-xl font-bold transition-all
              ${selectedId
                ? 'bg-primary text-white shadow-lg shadow-primary/40 hover:opacity-90 active:scale-[0.98]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
