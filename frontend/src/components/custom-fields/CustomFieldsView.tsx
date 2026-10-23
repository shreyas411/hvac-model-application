import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { services } from '../../services';
import { useCustomFields } from '../../data/customFields';
import { CustomFieldDefinition as Def } from '../../types';
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
import { FormDialog } from '../common/FormDialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { IconCancel, IconCheck, IconForms, IconGripVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

// One group per module; fields are ordered within their module (the order forms and drawers use).
const ENTITIES: [Def['entity'], string][] = [
  ['customer', 'Customers'], ['equipment', 'Equipment'], ['request', 'Service Requests'], ['job', 'Jobs'], ['quotation', 'Quotations'],
  ['invoice', 'Invoices'], ['part', 'Parts & Stock'], ['maintenance', 'Maintenance Plans'],
];

const SortableRow: React.FC<{ id: string; inactive?: boolean; children: (handle: React.ReactNode) => React.ReactNode }> = ({ id, inactive, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <Button type="button" variant="ghost" size="icon-xs" aria-label="Drag to reorder" {...attributes} {...listeners} className="text-muted-foreground cursor-grab touch-none shrink-0">
      <i className="flex text-lg"><IconGripVertical className="size-[1em]" aria-hidden="true" /></i>
    </Button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-2 py-2 bg-card ${inactive ? 'opacity-60' : ''} ${isDragging ? 'relative z-10 shadow-md opacity-90' : ''}`}>
      {children(handle)}
    </li>
  );
};
const TYPES: [Def['type'], string][] = [['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['select', 'Dropdown'], ['checkbox', 'Checkbox']];

interface Form { id?: string; entity: Def['entity']; type: Def['type']; label: string; options: string; required: boolean }

/** Admin-only: define extra fields that appear on the customer and equipment forms. */
export const CustomFieldsView: React.FC = () => {
  const { showToast, confirmToast } = useApp(['showToast', 'confirmToast']);
  const { all, setAll, reload } = useCustomFields(null);
  const [entity, setEntity] = useState<Def['entity']>('customer');
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const list = all.filter((d) => d.entity === entity);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = list.map((d) => d.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    // optimistic: show the new order now; run() reloads (and so reverts) once the server answers
    setAll((a) => [...a.filter((d) => d.entity !== entity), ...next.map((id) => list.find((d) => d.id === id)!)]);
    void run(services.customFields.reorder(next));
  };

  const run = (p: Promise<unknown>) => p.then(reload).then(() => true, (e) => { showToast(e.message ?? 'Request failed', 'error'); return false; });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const options = form.options.split(',').map((o) => o.trim()).filter(Boolean);
    setBusy(true);
    const ok = await run(form.id
      ? services.customFields.update(form.id, { label: form.label.trim(), options, required: form.required })
      : services.customFields.create({ entity: form.entity, type: form.type, label: form.label.trim(), options, required: form.required }));
    setBusy(false);
    if (ok) setForm(null);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Custom Fields</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Extra fields for each module, shown on its create and edit forms and detail views. Drag to set the order.</p>
        </div>
        <Button size="sm" onClick={() => setForm({ entity, type: 'text', label: '', options: '', required: false })} className="shrink-0"><IconPlus aria-hidden="true" />Add Custom Field</Button>
      </div>

      <Tabs value={entity} onValueChange={(v) => setEntity(v as Def['entity'])}>
        <TabsList className="flex-wrap h-auto">
          {ENTITIES.map(([v, title]) => <TabsTrigger key={v} value={v}>{title}<span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{all.filter((d) => d.entity === v).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card className="gap-0 py-4 px-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border text-xs">
              {list.map((d) => (
                <SortableRow key={d.id} id={d.id} inactive={d.inactive}>
                  {(handle) => (<>
                    {handle}
                    <span className="flex-1 min-w-0 break-words">{d.label}{d.type === 'select' && <span className="text-muted-foreground"> ({d.options.join(', ')})</span>}</span>
                    {d.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{TYPES.find(([t]) => t === d.type)?.[1]}</Badge>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`${d.inactive ? 'Activate' : 'Deactivate'} ${d.label}`} onClick={() => void run(services.customFields.update(d.id, { inactive: !d.inactive }))} title={d.inactive ? 'Inactive: hidden from forms. Click to activate' : 'Deactivate'} className={d.inactive ? 'text-emerald-600 hover:text-emerald-700' : 'text-destructive hover:text-destructive'}><i className="flex text-lg">{d.inactive ? <IconCheck className="size-[1em]" aria-hidden="true" /> : <IconCancel className="size-[1em]" aria-hidden="true" />}</i></Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Edit ${d.label}`} onClick={() => setForm({ id: d.id, entity: d.entity, type: d.type, label: d.label, options: d.options.join(', '), required: d.required })} title="Edit" className="text-muted-foreground"><i className="flex text-lg"><IconPencil className="size-[1em]" aria-hidden="true" /></i></Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete ${d.label}`} onClick={() => confirmToast(`Delete "${d.label}"? Values already entered are hidden.`, () => void run(services.customFields.remove(d.id)))} title="Delete" className="text-destructive hover:text-destructive"><i className="flex text-lg"><IconTrash className="size-[1em]" aria-hidden="true" /></i></Button>
                  </>)}
                </SortableRow>
              ))}
              {!list.length && <li><EmptyState icon={IconForms} compact>No custom fields yet.</EmptyState></li>}
            </ul>
          </SortableContext>
        </DndContext>
      </Card>

      {form && (
        <FormDialog onClose={() => setForm(null)} onSubmit={save} busy={busy} submitLabel={form.id ? 'Save' : 'Add'} title={form.id ? 'Edit Custom Field' : 'Add Custom Field'} description="The type can't be changed once created">
          {!form.id && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-entity" className="text-xs">Shown on</Label>
                <Select value={form.entity} onValueChange={(v) => setForm({ ...form, entity: v as Def['entity'] })}>
                  <SelectTrigger id="cf-entity" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTITIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-type" className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Def['type'] })}>
                  <SelectTrigger id="cf-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cf-label" className="text-xs">Label *</Label>
            <Input id="cf-label" required autoFocus name="label" autoComplete="off" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Gate code" />
          </div>
          {form.type === 'select' && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-options" className="text-xs">Options * (comma separated)</Label>
              <Input id="cf-options" required name="options" autoComplete="off" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="e.g. Gold, Silver, Bronze" />
            </div>
          )}
          {form.type !== 'checkbox' && (
            <Label className="text-xs font-normal"><Checkbox checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v === true })} />Required</Label>
          )}
        </FormDialog>
      )}
    </div>
  );
};
