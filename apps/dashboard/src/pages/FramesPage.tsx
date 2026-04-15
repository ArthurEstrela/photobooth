import React, { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, CheckCircle2, Download } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Button, Modal, Input, Select, Skeleton, EmptyState } from '../components/ui';
import {
  useTemplates, useUploadTemplate, useDeleteTemplate,
  useEventTemplates, useSetEventTemplates,
} from '../hooks/api/useTemplates';
import { useEvents } from '../hooks/api/useEvents';

function SortableItem({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm"
    >
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab">
        <GripVertical size={16} />
      </button>
      <span className="flex-1 text-sm text-gray-700">{name}</span>
      <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export const FramesPage: React.FC = () => {
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: events } = useEvents();
  const uploadTemplate = useUploadTemplate();
  const deleteTemplate = useDeleteTemplate();
  const setEventTemplates = useSetEventTemplates();

  const [selectedEventId, setSelectedEventId] = useState('');
  const { data: eventTemplates } = useEventTemplates(selectedEventId || null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  // Sync localOrder when eventTemplates change
  React.useEffect(() => {
    if (eventTemplates) {
      setLocalOrder(eventTemplates.map((et) => et.templateId));
    }
  }, [eventTemplates]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPhotoCount, setUploadPhotoCount] = useState<number | null>(null);
  const [uploadLayout, setUploadLayout] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedEvent = events?.find((e) => e.id === selectedEventId);
  const maxTemplates = selectedEvent?.maxTemplates ?? 5;

  const orderedEventTemplates = localOrder
    .map((id) => eventTemplates?.find((et) => et.templateId === id))
    .filter(Boolean) as NonNullable<typeof eventTemplates>[number][];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        setEventTemplates.mutate({ eventId: selectedEventId, templateIds: newOrder });
        return newOrder;
      });
    }
  };

  const addToEvent = (templateId: string) => {
    if (localOrder.length >= maxTemplates) return;
    if (localOrder.includes(templateId)) return;
    const newOrder = [...localOrder, templateId];
    setLocalOrder(newOrder);
    setEventTemplates.mutate({ eventId: selectedEventId, templateIds: newOrder });
  };

  const removeFromEvent = (templateId: string) => {
    const newOrder = localOrder.filter((id) => id !== templateId);
    setLocalOrder(newOrder);
    setEventTemplates.mutate({ eventId: selectedEventId, templateIds: newOrder });
  };

  const handleUpload = () => {
    if (!uploadFile || !uploadName.trim()) return;
    uploadTemplate.mutate(
      { name: uploadName.trim(), file: uploadFile, photoCount: uploadPhotoCount, layout: uploadLayout },
      {
        onSuccess: () => {
          setUploadOpen(false);
          setUploadName('');
          setUploadFile(null);
          setUploadPhotoCount(null);
          setUploadLayout(null);
        },
      },
    );
  };

  const eventOptions = [
    { value: '', label: 'Selecionar evento...' },
    ...(events ?? []).map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Molduras</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Pool de Molduras ───────────────────────────── */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">Pool de Molduras</p>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus size={14} /> Adicionar Moldura
            </Button>
          </div>

          {templatesLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !templates?.length ? (
            <EmptyState
              title="Nenhuma moldura ainda"
              description="Faça upload de arquivos PNG transparentes."
            />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {templates.map((t) => {
                const inEvent = localOrder.includes(t.id);
                return (
                  <div key={t.id} className="relative group">
                    {/* Checkerboard background for transparent PNG */}
                    <div
                      className="aspect-square rounded-xl overflow-hidden border-2 transition-colors cursor-pointer"
                      style={{ backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)', backgroundSize: '12px 12px', backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px', borderColor: inEvent ? '#4f46e5' : '#e5e7eb' }}
                      onClick={() => selectedEventId && addToEvent(t.id)}
                    >
                      <img src={t.overlayUrl} alt={t.name} className="w-full h-full object-contain" />
                      {t.photoCount && (
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded leading-tight">
                          {t.photoCount === 4 && t.layout === 'strip' ? '4× tira' : t.photoCount === 4 ? '4× grade' : `${t.photoCount}×`}
                        </div>
                      )}
                      {inEvent && (
                        <div className="absolute top-1 right-1 text-primary">
                          <CheckCircle2 size={16} fill="white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-center text-gray-600 mt-1 truncate">{t.name}</p>
                    <button
                      onClick={() => deleteTemplate.mutate(t.id)}
                      className="absolute top-1 left-1 hidden group-hover:flex p-1 bg-white rounded-lg shadow text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Right: Molduras do Evento ────────────────────────── */}
        <Card padding="md" className="space-y-4">
          <p className="font-semibold text-gray-900">Molduras do Evento</p>
          <Select
            label="Evento"
            options={eventOptions}
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          />

          {!selectedEventId ? (
            <p className="text-sm text-gray-400 text-center py-8">Selecione um evento para gerenciar as molduras.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {localOrder.length} / {maxTemplates} molduras — arraste para reordenar
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedEventTemplates.map((et) => (
                      <SortableItem
                        key={et.templateId}
                        id={et.templateId}
                        name={et.template.name}
                        onRemove={() => removeFromEvent(et.templateId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {localOrder.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Clique em uma moldura no pool para adicioná-la aqui.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Adicionar Moldura">
        <div className="space-y-4">
          <Input label="Nome da moldura" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />

          <Select
            label="Número de fotos"
            value={uploadPhotoCount === null ? '' : String(uploadPhotoCount)}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setUploadPhotoCount(val);
              if (val !== 4) setUploadLayout(null);
            }}
            options={[
              { value: '', label: 'Qualquer (compatível com todos)' },
              { value: '1', label: '1 foto' },
              { value: '2', label: '2 fotos' },
              { value: '4', label: '4 fotos' },
            ]}
          />

          {uploadPhotoCount === 4 && (
            <Select
              label="Layout das 4 fotos"
              value={uploadLayout ?? 'grid'}
              onChange={(e) => setUploadLayout(e.target.value)}
              options={[
                { value: 'grid', label: 'Grade 2×2 (lado a lado)' },
                { value: 'strip', label: 'Tira 1×4 (empilhadas — clássico)' },
              ]}
            />
          )}

          {/* Guide download links */}
          {uploadPhotoCount !== null && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-indigo-700">Baixar molde para design</p>
              <p className="text-xs text-indigo-500">Abra no Figma ou Photoshop e crie a decoração nas bordas.</p>
              <a
                href={
                  uploadPhotoCount === 1 ? '/templates/guia-1-foto.svg' :
                  uploadPhotoCount === 2 ? '/templates/guia-2-fotos.svg' :
                  uploadLayout === 'strip' ? '/templates/guia-4-fotos-tira.svg' :
                  '/templates/guia-4-fotos-grade.svg'
                }
                download
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <Download size={12} />
                {uploadPhotoCount === 1 && 'guia-1-foto.svg (1280×720)'}
                {uploadPhotoCount === 2 && 'guia-2-fotos.svg (1280×1440)'}
                {uploadPhotoCount === 4 && uploadLayout === 'strip' && 'guia-4-fotos-tira.svg (1280×2880)'}
                {uploadPhotoCount === 4 && uploadLayout !== 'strip' && 'guia-4-fotos-grade.svg (2560×1440)'}
              </a>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Arquivo PNG</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} loading={uploadTemplate.isPending} disabled={!uploadFile || !uploadName}>
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
