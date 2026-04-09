import React, { useState } from 'react';
import { useBooths, useCreateBooth } from '../hooks/api/useBooths';
import { Plus, Smartphone, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { OfflineMode } from '@packages/shared';

export const BoothsPage: React.FC = () => {
  const { data: booths, isLoading } = useBooths();
  const createMutation = useCreateBooth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', offlineMode: OfflineMode.BLOCK });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form, {
      onSuccess: () => {
        setIsModalOpen(false);
        setForm({ name: '', offlineMode: OfflineMode.BLOCK });
      },
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cabines</h2>
          <p className="text-gray-500">Gerencie seus dispositivos fotográficos.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Nova Cabine
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {booths?.map((booth) => (
            <div key={booth.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Smartphone size={24} className="text-gray-600" />
                </div>
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                    booth.isOnline
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {booth.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {booth.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{booth.name}</h3>
              <p className="text-sm text-gray-400 mt-1 font-mono truncate">{booth.token}</p>
              <p className="text-xs text-gray-400 mt-2">Modo offline: {booth.offlineMode}</p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Cadastrar Nova Cabine</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                  placeholder="Ex: Cabine do Salão"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modo Offline</label>
                <select
                  value={form.offlineMode}
                  onChange={(e) => setForm({ ...form, offlineMode: e.target.value as OfflineMode })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value={OfflineMode.BLOCK}>Bloquear</option>
                  <option value={OfflineMode.DEMO}>Demonstração</option>
                  <option value={OfflineMode.CREDITS}>Créditos</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Criando...' : 'Criar Cabine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
