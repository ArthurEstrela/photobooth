import React, { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, Drawer, Input, Select, Modal, Skeleton, EmptyState } from '../components/ui';
import { useBooths, useCreateBooth, useSetBoothEvent, useUpdateBoothDevices } from '../hooks/api/useBooths';
import { useEvents } from '../hooks/api/useEvents';
import { DeviceStatusEvent } from '@packages/shared';

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

export const BoothsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: booths, isLoading } = useBooths();
  const { data: events } = useEvents();
  const createBooth = useCreateBooth();
  const setBoothEvent = useSetBoothEvent();
  const updateDevices = useUpdateBoothDevices();

  const [drawerBooth, setDrawerBooth] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // Device section state
  const [devCamera, setDevCamera] = useState('');
  const [devPrinter, setDevPrinter] = useState('');
  const [devApplied, setDevApplied] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSaved, setPinSaved] = useState(false);

  const openDrawer = (booth: any) => {
    setDrawerBooth(booth);
    setDevApplied(false);
    setPinSaved(false);
    setPinInput('');
    const deviceStatus = queryClient.getQueryData<DeviceStatusEvent>(['booth_devices', booth.id]);
    setDevCamera(deviceStatus?.selectedCamera ?? '');
    setDevPrinter(deviceStatus?.selectedPrinter ?? '');
  };

  const getDeviceStatus = (boothId: string) =>
    queryClient.getQueryData<DeviceStatusEvent>(['booth_devices', boothId]);

  const handleApplyDevices = () => {
    if (!drawerBooth) return;
    updateDevices.mutate(
      { boothId: drawerBooth.id, selectedCamera: devCamera || undefined, selectedPrinter: devPrinter || undefined },
      {
        onSuccess: () => {
          setDevApplied(true);
          setTimeout(() => setDevApplied(false), 2000);
        },
      },
    );
  };

  const handleSavePin = async () => {
    if (!drawerBooth || pinInput.length !== 4) return;
    const hash = await hashPin(pinInput);
    updateDevices.mutate(
      { boothId: drawerBooth.id, maintenancePin: hash },
      {
        onSuccess: () => {
          setPinSaved(true);
          setPinInput('');
          setTimeout(() => setPinSaved(false), 2000);
        },
      },
    );
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createBooth.mutate(
      { name: newName.trim() },
      { onSuccess: () => { setCreateOpen(false); setNewName(''); createBooth.reset(); } },
    );
  };

  const handleCreateCancel = () => { setCreateOpen(false); setNewName(''); createBooth.reset(); };

  const eventOptions = [
    { value: '', label: 'Nenhum evento' },
    ...(events ?? []).map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cabines</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Nova Cabine
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : !booths?.length ? (
        <EmptyState
          title="Nenhuma cabine cadastrada"
          description="Crie sua primeira cabine para começar."
          action={{ label: 'Nova Cabine', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {booths.map((booth) => (
            <Card key={booth.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{booth.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {booth.activeEvent?.name ?? 'Sem evento ativo'}
                  </p>
                </div>
                <Badge variant={booth.isOnline ? 'success' : 'neutral'}>
                  {booth.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <Button variant="secondary" size="sm" onClick={() => openDrawer(booth)}>
                <Settings2 size={14} /> Configurar
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={handleCreateCancel} title="Cadastrar Cabine">
        <div className="space-y-4">
          <Input
            label="Nome da cabine"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Cabine Salão Principal"
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={handleCreateCancel}>Cancelar</Button>
            <Button onClick={handleCreate} loading={createBooth.isPending} disabled={!newName.trim()}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Config Drawer */}
      {drawerBooth && (
        <Drawer open onClose={() => setDrawerBooth(null)} title="Configurar Cabine">
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-700">{drawerBooth.name}</p>

            <Select
              label="Evento ativo"
              options={eventOptions}
              value={drawerBooth.activeEventId ?? ''}
              onChange={(e) => {
                const eventId = e.target.value || null;
                setBoothEvent.mutate(
                  { boothId: drawerBooth.id, eventId },
                  { onSuccess: () => {
                    setDrawerBooth({ ...drawerBooth, activeEventId: eventId, activeEvent: events?.find((ev) => ev.id === eventId) ?? null });
                  }},
                );
              }}
            />

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${drawerBooth.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">
                  {drawerBooth.isOnline ? 'Cabine online' : 'Cabine offline'}
                </span>
              </div>

              {/* ── Dispositivos ──────────────────────────────── */}
              {(() => {
                const deviceStatus = getDeviceStatus(drawerBooth.id);
                return (
                  <div className={`space-y-3 ${!drawerBooth.isOnline && deviceStatus ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Dispositivos</p>
                      {deviceStatus && (
                        <span className="text-xs text-gray-400">{timeAgo(deviceStatus.lastSeen)}</span>
                      )}
                    </div>

                    {!deviceStatus ? (
                      <p className="text-xs text-gray-400 italic">Aguardando dados da cabine...</p>
                    ) : (
                      <>
                        {!drawerBooth.isOnline && (
                          <p className="text-xs text-amber-600">Dados do último heartbeat</p>
                        )}
                        <div className="space-y-2">
                          <label className="block text-xs text-gray-500">Câmera</label>
                          <select
                            value={devCamera}
                            onChange={(e) => setDevCamera(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="">Selecione</option>
                            {deviceStatus.cameras.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-gray-500">Impressora</label>
                          <select
                            value={devPrinter}
                            onChange={(e) => setDevPrinter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="">Selecione</option>
                            {deviceStatus.printers.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleApplyDevices}
                          loading={updateDevices.isPending}
                          disabled={!drawerBooth.isOnline || devApplied}
                        >
                          {devApplied ? 'Aplicado ✓' : 'Aplicar'}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── PIN de manutenção ─────────────────────────── */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">PIN de manutenção</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:border-primary"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSavePin}
                    disabled={pinInput.length !== 4 || pinSaved}
                    loading={updateDevices.isPending}
                  >
                    {pinSaved ? 'Salvo ✓' : 'Salvar PIN'}
                  </Button>
                </div>
              </div>

              {/* ── Credenciais ───────────────────────────────── */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Credenciais para o Totem</p>
                <div>
                  <p className="text-xs text-gray-500 mb-1">ID da Cabine (VITE_BOOTH_ID)</p>
                  <code className="text-xs break-all bg-gray-50 p-1 block rounded border border-gray-200 select-all">
                    {drawerBooth.id}
                  </code>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Token (VITE_BOOTH_TOKEN)</p>
                  <code className="text-xs break-all bg-gray-50 p-1 block rounded border border-gray-200 select-all">
                    {drawerBooth.token}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
