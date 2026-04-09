import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Instagram, Send, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const GuestPhoto: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data, isLoading } = useQuery<{ sessionId: string; photoUrls: string[] }>({
    queryKey: ['guest-photo', sessionId],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/photos/public/${sessionId}`);
      return data;
    },
    enabled: !!sessionId,
    retry: false,
  });

  const primaryPhotoUrl = data?.photoUrls[0];

  const handleDownload = async () => {
    if (!primaryPhotoUrl) return;
    const response = await fetch(primaryPhotoUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photobooth-${sessionId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-6 font-sans">
      <header className="w-full max-w-md flex justify-between items-center py-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">P</div>
          <span className="font-bold tracking-tight text-lg">PhotoBooth OS</span>
        </div>
        <span className="text-xs text-neutral-500 font-mono uppercase tracking-widest">
          {sessionId?.slice(0, 8)}
        </span>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col gap-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-white" size={32} />
          </div>
        ) : primaryPhotoUrl ? (
          <>
            <div className="relative group animate-in fade-in zoom-in duration-700">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800">
                <img
                  src={primaryPhotoUrl}
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
          </>
        ) : (
          <p className="text-center text-neutral-400">Foto não encontrada.</p>
        )}

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
