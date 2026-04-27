import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, Button, Modal, Input, Select, Badge, Skeleton, EmptyState } from '../components/ui';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '../hooks/api/useEvents';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const DEFAULT_FORM = {
  name: '', price: '', digitalPrice: '', maxTemplates: '5',
};

export const EventsPage: React.FC = () => {
  const { data: events, isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const openCreate = () => { setEditEvent(null); setForm(DEFAULT_FORM); setModalOpen(true); };
  const openEdit = (ev: any) => {
    setEditEvent(ev);
    setForm({
      name: ev.name,
      price: String(ev.price),
      digitalPrice: ev.digitalPrice != null ? String(ev.digitalPrice) : '',
      maxTemplates: String(ev.maxTemplates ?? 5),
    });
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditEvent(null);
    createEvent.reset();
    updateEvent.reset();
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      price: parseFloat(form.price),
      digitalPrice: form.digitalPrice ? parseFloat(form.digitalPrice) : null,
      maxTemplates: parseInt(form.maxTemplates),
    };
    if (editEvent) {
      updateEvent.mutate({ id: editEvent.id, ...payload }, { onSuccess: closeModal });
    } else {
      createEvent.mutate(payload, { onSuccess: closeModal });
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const isPending = createEvent.isPending || updateEvent.isPending;
  const isError = createEvent.isError || updateEvent.isError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo Evento</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : !events?.length ? (
        <EmptyState
          title="Nenhum evento cadastrado"
          description="Crie um evento para configurar preços e fotos."
          action={{ label: 'Novo Evento', onClick: openCreate }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card padding="none" className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nome', 'Preço', 'Digital', 'Molduras', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{ev.name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(Number(ev.price))}</td>
                    <td className="px-4 py-3">
                      {ev.digitalPrice != null
                        ? <Badge variant="primary">{formatCurrency(Number(ev.digitalPrice))}</Badge>
                        : <Badge variant="neutral">Grátis</Badge>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ev.maxTemplates ?? 5}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(ev)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(ev.id)}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {events.map((ev) => (
              <Card key={ev.id} padding="md" className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{ev.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(Number(ev.price))}</p>
                  </div>
                  {ev.digitalPrice != null
                    ? <Badge variant="primary">Digital {formatCurrency(Number(ev.digitalPrice))}</Badge>
                    : <Badge variant="neutral">Digital grátis</Badge>
                  }
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(ev)}><Pencil size={13} /> Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(ev.id)}><Trash2 size={13} /></Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editEvent ? 'Editar Evento' : 'Criar Evento'} maxWidth="md">
        <div className="space-y-4">
          <Input label="Nome do evento" value={form.name} onChange={f('name')} placeholder="Ex: Casamento Silva" />
          <Input label="Preço por sessão (R$)" type="number" min="0" step="0.01" value={form.price} onChange={f('price')} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preço do digital (R$)"
              type="number"
              min="0"
              step="0.01"
              value={form.digitalPrice}
              onChange={f('digitalPrice')}
              hint="Vazio = download gratuito"
            />
            <Input
              label="Máx. de molduras"
              type="number"
              min="1"
              max="10"
              value={form.maxTemplates}
              onChange={f('maxTemplates')}
            />
          </div>
          {isError && (
            <p className="text-sm text-red-600">Ocorreu um erro. Tente novamente.</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              loading={isPending}
              disabled={!form.name || !form.price}
            >
              {editEvent ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
