import React from 'react';
import { ITemplate } from '@packages/shared';

interface Props {
  templates: ITemplate[];
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  onConfirm: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const TemplateSelector: React.FC<Props> = ({
  templates,
  selectedTemplateId,
  onSelect,
  onConfirm,
  videoRef,
}) => {
  const selected = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Left: Live camera preview with selected overlay */}
      <div className="relative w-1/2 h-full bg-gray-900 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
        {selected && (
          <img
            src={selected.overlayUrl}
            alt="frame preview"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/40 text-2xl font-light">Escolha uma moldura →</p>
          </div>
        )}
      </div>

      {/* Right: Template grid */}
      <div className="w-1/2 h-full flex flex-col p-8 overflow-y-auto">
        <h2 className="text-3xl font-bold mb-6 tracking-tight">Escolha sua Moldura</h2>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {templates.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template.id)}
                className={`relative rounded-xl overflow-hidden border-4 transition-all duration-200 aspect-[2/3] ${
                  isSelected
                    ? 'border-[color:var(--color-primary)] scale-[1.03] shadow-2xl'
                    : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              >
                <img
                  src={template.overlayUrl}
                  alt={template.name}
                  className="w-full h-full object-cover bg-gray-800"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-center font-semibold text-sm">{template.name}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-[color:var(--color-primary)] rounded-full p-1.5">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onConfirm}
          disabled={!selectedTemplateId}
          className="mt-8 w-full bg-[color:var(--color-primary)] hover:opacity-90 disabled:opacity-30 text-white font-black text-2xl py-5 rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          CONFIRMAR E PAGAR
        </button>
      </div>
    </div>
  );
};
