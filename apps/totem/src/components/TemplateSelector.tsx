// apps/totem/src/components/TemplateSelector.tsx

import React from 'react';
import { Template } from '../../../../packages/shared/src/types';

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  onConfirm: () => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ 
  templates, 
  selectedTemplateId, 
  onSelect,
  onConfirm
}) => {
  if (templates.length === 0) return null;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-black/90 min-h-screen text-white">
      <h2 className="text-4xl font-bold mb-10 tracking-tight">Escolha sua Moldura</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 w-full max-w-5xl">
        {templates.map((template) => (
          <div 
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={`cursor-pointer transition-all duration-300 relative rounded-2xl overflow-hidden border-4 ${
              selectedTemplateId === template.id ? 'border-blue-500 scale-105 shadow-2xl shadow-blue-500/50' : 'border-transparent opacity-60'
            }`}
          >
            <img 
              src={template.overlayUrl} 
              alt={template.name}
              className="w-full aspect-[2/3] object-cover bg-gray-800"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-center font-bold text-lg">{template.name}</p>
            </div>
            {selectedTemplateId === template.id && (
              <div className="absolute top-4 right-4 bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={!selectedTemplateId}
        className="mt-16 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white font-black text-3xl px-16 py-6 rounded-full transition-all active:scale-95 shadow-xl"
      >
        CONFIRMAR E PAGAR
      </button>
    </div>
  );
};
