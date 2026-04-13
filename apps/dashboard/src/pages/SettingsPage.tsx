import React, { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Card, Button, Input, Modal, Skeleton } from '../components/ui';
import { useSettings, useUpdateSettings, useUploadLogo, useChangePassword } from '../hooks/api/useSettings';
import { useAuth } from '../context/AuthContext';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const uploadLogo = useUploadLogo();
  const changePassword = useChangePassword();
  const { user } = useAuth();

  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brandName ?? '');
      setPrimaryColor(settings.primaryColor ?? '#4f46e5');
    }
  }, [settings]);

  // Live preview of primary color
  useEffect(() => {
    try {
      const rgb = hexToRgb(primaryColor);
      document.documentElement.style.setProperty('--color-primary-rgb', rgb);
    } catch {}
  }, [primaryColor]);

  const handleSaveBranding = () => {
    updateSettings.mutate({ brandName, primaryColor });
  };

  const handleClosePasswordModal = () => {
    setPasswordOpen(false);
    setPwForm({ current: '', next: '', confirm: '' });
    setPwError(null);
    changePassword.reset();
  };

  const handleChangePassword = () => {
    setPwError(null);
    changePassword.mutate(
      { currentPassword: pwForm.current, newPassword: pwForm.next },
      {
        onSuccess: handleClosePasswordModal,
        onError: (err: any) => {
          setPwError(
            err?.response?.data?.message ?? 'Erro ao alterar senha. Tente novamente.',
          );
        },
      },
    );
  };

  const handleLogoUpload = (file: File) => {
    uploadLogo.mutate(file);
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      {/* Identity / White-label */}
      <Card padding="md" className="space-y-5">
        <p className="font-semibold text-gray-900">Identidade Visual</p>

        {/* Logo upload */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Logo</label>
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="logo" className="h-12 object-contain mb-3 rounded-lg" />
          )}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} className="text-gray-400" />
            <span className="text-sm text-gray-500">Enviar logo</span>
            <span className="text-xs text-gray-400">PNG ou SVG recomendado</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
            }}
          />
          {uploadLogo.isPending && <p className="text-xs text-gray-400 mt-1">Enviando...</p>}
        </div>

        <Input
          label="Nome da marca"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Ex: PhotoBooth OS"
        />

        {/* Color picker */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Cor primária</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4f46e5"
              className="font-mono"
            />
            <div
              className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
              style={{ backgroundColor: primaryColor }}
              title="Preview"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveBranding} loading={updateSettings.isPending}>
            Salvar alterações
          </Button>
        </div>
      </Card>

      {/* Account */}
      <Card padding="md" className="space-y-4">
        <p className="font-semibold text-gray-900">Conta</p>
        <Input label="Email" value={user?.email ?? ''} disabled />
        <Button variant="secondary" size="sm" onClick={() => setPasswordOpen(true)}>
          Alterar senha
        </Button>
      </Card>

      {/* Change Password Modal */}
      <Modal open={passwordOpen} onClose={handleClosePasswordModal} title="Alterar senha">
        <div className="space-y-4">
          <Input label="Senha atual" type="password" value={pwForm.current} onChange={(e) => setPwForm(p => ({ ...p, current: e.target.value }))} />
          <Input label="Nova senha" type="password" value={pwForm.next} onChange={(e) => setPwForm(p => ({ ...p, next: e.target.value }))} />
          <Input
            label="Confirmar nova senha"
            type="password"
            value={pwForm.confirm}
            onChange={(e) => setPwForm(p => ({ ...p, confirm: e.target.value }))}
            error={pwForm.confirm && pwForm.next !== pwForm.confirm ? 'As senhas não coincidem' : undefined}
          />
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={handleClosePasswordModal}>Cancelar</Button>
            <Button
              onClick={handleChangePassword}
              loading={changePassword.isPending}
              disabled={
                !pwForm.current ||
                !pwForm.next ||
                pwForm.next !== pwForm.confirm ||
                changePassword.isPending
              }
            >
              Alterar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
