import React, { useState } from 'react';
import { useGallery } from '../hooks/api/useGallery';
import { Loader2, ChevronLeft, ChevronRight, Image } from 'lucide-react';

export const GalleryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGallery(page, 20);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Galeria de Fotos</h2>
        <p className="text-gray-500">Todas as sessões realizadas nas suas cabines.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Image size={48} className="mb-4 opacity-30" />
          <p>Nenhuma sessão registrada ainda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data.map((session) => (
              <div
                key={session.sessionId}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {session.photoUrls[0] ? (
                  <img
                    src={session.photoUrls[0]}
                    alt={`Sessão ${session.sessionId}`}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <Image size={32} className="text-gray-300" />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-semibold text-gray-900 truncate">{session.eventName}</p>
                  <p className="text-sm text-gray-500">{session.boothName}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2 py-1 rounded-full">
                      {session.photoUrls.length} fotos
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data && data.total > data.limit && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {Math.ceil(data.total / data.limit)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / data.limit)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
