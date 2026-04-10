import React, { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Card, Badge, Button, Drawer, Input, Select, Modal, Skeleton, EmptyState } from '../components/ui';
import { useBooths, useCreateBooth, useSetBoothEvent } from '../hooks/api/useBooths';
import { useEvents } from '../hooks/api/useEvents';

export const BoothsPage: React.FC = () => {
  const { data: booths, isLoading } = useBooths();
  const { data: events } = useEvents();
  const createBooth = useCreateBooth();
  const setBoothEvent = useSetBoothEvent();

  const [drawerBooth, setDrawerBooth] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createBooth.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => { setCreateOpen(false); setNewName(''); createBooth.reset(); },
      },
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDrawerBooth(booth)}
              >
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
            <Button
              onClick={handleCreate}
              loading={createBooth.isPending}
              disabled={!newName.trim()}
            >
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Config Drawer */}
      {drawerBooth && (
        <Drawer
          open
          onClose={() => setDrawerBooth(null)}
          title="Configurar Cabine"
        >
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
                    // Manual update for better UX in test, though React Query would handle this via invalidation
                    setDrawerBooth({ ...drawerBooth, activeEventId: eventId, activeEvent: events?.find((ev) => ev.id === eventId) ?? null });
                  }},
                );
              }}
            />
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${drawerBooth.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">
                  {drawerBooth.isOnline ? 'Cabine online' : 'Cabine offline'}
                </span>
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
