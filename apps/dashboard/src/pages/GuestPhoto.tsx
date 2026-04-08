// apps/dashboard/src/pages/GuestPhoto.tsx

import React from 'react';
import { useParams } from 'react-router-dom';
import { Download, Share2, Instagram, Send } from 'lucide-react';

export const GuestPhoto: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  // Mock data - In production this would be a useQuery fetching by sessionId
  const photoUrl = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1000";

  const handleDownload = async () => {
    const response = await fetch(photoUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photobooth-${sessionId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-6 font-sans">
      <header className="w-full max-w-md flex justify-between items-center py-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">P</div>
          <span className="font-bold tracking-tight text-lg">PhotoBooth OS</span>
        </div>
        <span className="text-xs text-neutral-500 font-mono uppercase tracking-widest">{sessionId?.slice(0, 8)}</span>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col gap-8">
        <div className="relative group animate-in fade-in zoom-in duration-700">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800">
            <img 
              src={photoUrl} 
              alt="Sua Foto" 
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={handleDownload}
            className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl shadow-lg"
          >
            <Download size={24} strokeWidth={3} />
            BAIXAR FOTO
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button className="bg-neutral-900 border border-neutral-800 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all">
              <Instagram size={20} className="text-pink-500" />
              Instagram
            </button>
            <button className="bg-neutral-900 border border-neutral-800 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all">
              <Send size={20} className="text-blue-400" />
              WhatsApp
            </button>
          </div>
        </div>

        <p className="text-center text-neutral-500 text-sm mt-4 px-6 leading-relaxed">
          Obrigado por celebrar conosco! Suas memórias foram capturadas com sucesso.
        </p>
      </main>

      <footer className="py-10 text-neutral-700 text-xs uppercase tracking-[0.2em] font-medium">
        Powered by PhotoBooth OS
      </footer>
    </div>
  );
};
