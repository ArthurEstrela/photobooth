import React, { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/api/useSettings';
import { Loader2, Save, Palette } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState({
    brandName: '',
    primaryColor: '#1d4ed8',
    logoUrl: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        brandName: settings.brandName ?? '',
        primaryColor: settings.primaryColor ?? '#1d4ed8',
        logoUrl: settings.logoUrl ?? '',
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      brandName: form.brandName || null,
      primaryColor: form.primaryColor || null,
      logoUrl: form.logoUrl || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
        <p className="text-gray-500">White-label e identidade visual da sua marca.</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Palette size={20} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Identidade Visual</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Marca
            </label>
            <input
              type="text"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="Ex: Estúdio Silva Fotos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cor Principal
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none font-mono text-sm"
                placeholder="#1d4ed8"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL do Logo (PNG/SVG)
            </label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="https://s3.amazonaws.com/seu-logo.png"
            />
            {form.logoUrl && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg inline-block">
                <img src={form.logoUrl} alt="Preview" className="h-12 object-contain" />
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Salvar Configurações
            </button>
            {updateMutation.isSuccess && (
              <p className="mt-3 text-sm text-green-600 font-medium">Configurações salvas!</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
