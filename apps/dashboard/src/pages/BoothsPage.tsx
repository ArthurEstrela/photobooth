import React, { useState } from 'react';
import { Plus, Settings2, Link2, Link2Off, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, Drawer, Input, Select, Modal, Skeleton, EmptyState } from '../components/ui';
import { useBooths, useCreateBooth, useSetBoothEvent, useUpdateBoothDevices, useDeleteBooth } from '../hooks/api/useBooths';
import { useEvents } from '../hooks/api/useEvents';
import { DeviceStatusEvent, IBoothWithStatus } from '@packages/shared';
import { usePairingCode } from '../hooks/api/usePairingCode';
import { PairingModal } from '../components/PairingModal';

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

  const deleteBooth = useDeleteBooth();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const generatePairingCode = usePairingCode();
  const [pairingBooth, setPairingBooth] = useState<IBoothWithStatus | null>(null);
  const [pairingData, setPairingData] = useState<{ code: string; expiresAt: string } | null>(null);

  const [drawerBooth, setDrawerBooth] = useState<IBoothWithStatus | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // Device section state
  const [devCamera, setDevCamera] = useState('');
  const [devPrinter, setDevPrinter] = useState('');
  const [devApplied, setDevApplied] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSaved, setPinSaved] = useState(false);

  const openDrawer = (booth: IBoothWithStatus) => {
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
                <div className="flex items-center gap-2">
                  <Badge variant={booth.isOnline ? 'success' : 'neutral'}>
                    {booth.isOnline ? 'Online' : 'Offline'}
                  </Badge>
                  <Badge variant={booth.pairedAt ? 'success' : 'neutral'}>
                    {booth.pairedAt ? 'Pareado' : 'Não pareado'}
                  </Badge>
                </div>
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

              {/* ── Pareamento ───────────────────────────────── */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Pareamento</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {drawerBooth.pairedAt ? (
                    <><Link2 size={14} className="text-green-500" /> Pareado</>
                  ) : (
                    <><Link2Off size={14} /> Não pareado</>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPairingBooth(drawerBooth);
                    generatePairingCode.mutate(drawerBooth.id, {
                      onSuccess: (data) => setPairingData(data),
                    });
                  }}
                  loading={generatePairingCode.isPending}
                >
                  Gerar código de pareamento
                </Button>
              </div>

            </div>

            {/* Delete */}
            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={() => setDeleteConfirmId(drawerBooth.id)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                <Trash2 size={14} /> Excluir cabine
              </button>
            </div>

          </div>
        </Drawer>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <Modal open onClose={() => setDeleteConfirmId(null)} title="Excluir cabine">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir esta cabine? Todos os pagamentos e sessões associados serão removidos permanentemente.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
              <Button
                variant="danger"
                loading={deleteBooth.isPending}
                onClick={() => {
                  deleteBooth.mutate(deleteConfirmId, {
                    onSuccess: () => {
                      setDeleteConfirmId(null);
                      setDrawerBooth(null);
                    },
                  });
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {pairingBooth && pairingData && (
        <PairingModal
          code={pairingData.code}
          expiresAt={pairingData.expiresAt}
          onClose={() => { setPairingBooth(null); setPairingData(null); generatePairingCode.reset(); }}
          onRegenerate={() => {
            generatePairingCode.reset();
            generatePairingCode.mutate(pairingBooth.id, {
              onSuccess: (data) => setPairingData(data),
            });
          }}
        />
      )}
    </div>
  );
};
