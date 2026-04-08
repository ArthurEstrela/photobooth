// apps/dashboard/src/pages/EventsPage.tsx

import React, { useState } from 'react';
import { useEvents, useCreateEvent, useDeleteEvent } from '../hooks/api/useEvents';
import { Plus, Trash2, Edit2, Loader2, Calendar } from 'lucide-react';

export const EventsPage: React.FC = () => {
  const { data: events, isLoading } = useEvents();
  const createMutation = useCreateEvent();
  const deleteMutation = useDeleteEvent();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    overlayUrl: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      price: Number(formData.price),
      overlayUrl: formData.overlayUrl,
    }, {
      onSuccess: () => {
        setIsModalOpen(false);
        setFormData({ name: '', price: '', overlayUrl: '' });
      }
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Eventos</h2>
          <p className="text-gray-500">Configure as festas e cabines aqui.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Novo Evento
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event) => (
            <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                <Calendar className="text-white opacity-20" size={64} />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Preço por sessão: <strong>R$ {Number(event.price).toFixed(2)}</strong>
                </p>
                
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <Edit2 size={16} />
                    Editar
                  </button>
                  <button 
                    onClick={() => deleteMutation.mutate(event.id)}
                    className="w-10 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Basic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Cadastrar Novo Evento</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Evento</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" 
                  placeholder="Ex: Casamento João e Maria"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço da Sessão (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" 
                  placeholder="15.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Moldura (PNG)</label>
                <input 
                  type="url"
                  value={formData.overlayUrl}
                  onChange={(e) => setFormData({ ...formData, overlayUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" 
                  placeholder="https://s3.amazonaws.com/moldura.png"
                />
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
                  {createMutation.isPending ? 'Salvando...' : 'Criar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
