import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { services } from '../../services';
import { useChecklistTemplates } from '../../data/checklistTemplates';
import { ChecklistTemplate, JobType } from '../../types';
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { FormDialog } from '../common/FormDialog';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { DetailDrawer } from '../common/DetailDrawer';
import { Label } from '@/src/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/tabs';
import { IconCancel, IconCheck, IconChecklist, IconGripVertical, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

const TYPES: [JobType, string][] = [
  ['installation', 'Installation'],
  ['repair', 'Repair'],
  ['inspection', 'Inspection / CP12 Gas Check'],
  ['emergency_callout', 'Emergency Callout'],
  ['preventive_maintenance', 'Preventive Maintenance'],
];
const CATEGORIES: ChecklistTemplate['category'][] = ['general', 'gas_safety', 'electrical', 'refrigerant'];

type Category = ChecklistTemplate['category'];
const CategorySelect: React.FC<{ value: Category; onChange: (c: Category) => void; className?: string }> = ({ value, onChange, className }) => (
  <Select value={value} onValueChange={(v) => onChange(v as Category)}>
    <SelectTrigger aria-label="Category" size="sm" className={`text-xs capitalize ${className ?? ''}`}><SelectValue /></SelectTrigger>
    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
  </Select>
);

const SortableRow: React.FC<{ id: string; editing: boolean; children: (handle: React.ReactNode) => React.ReactNode }> = ({ id, editing, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: editing });
  const handle = (
    <Button type="button" variant="ghost" size="icon-xs" aria-label="Drag to reorder" {...attributes} {...listeners} className="text-muted-foreground cursor-grab touch-none shrink-0">
      <i className="flex text-lg"><IconGripVertical className="size-[1em]" aria-hidden="true" /></i>
    </Button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 py-2 bg-card ${isDragging ? 'relative z-10 shadow-md opacity-90' : ''}`}
    >
      {children(handle)}
    </li>
  );
};

/** Admin-only: manage the checklist items offered for each job type. */
export const ChecklistsView: React.FC = () => {
  const { showToast, confirmToast } = useApp(['showToast', 'confirmToast']);
  const { templates, setTemplates, reload } = useChecklistTemplates();
  const [jobType, setJobType] = useState<JobType>('repair');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [viewType, setViewType] = useState<JobType>('repair');
  const [category, setCategory] = useState<ChecklistTemplate['category']>('general');

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState<ChecklistTemplate['category']>('general');

  // resolves true on success so callers only reset their input when the save worked
  const run = (p: Promise<unknown>) => p.then(reload).then(() => true, (e) => { showToast(e.message ?? 'Request failed', 'error'); return false; });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    void run(services.checklistTemplates.create({ jobType, label: label.trim(), category })).then((ok) => { if (ok) { setLabel(''); setAdding(false); setViewType(jobType); } });
  };

  const startEdit = (t: ChecklistTemplate) => { setEditId(t.id); setEditLabel(t.label); setEditCategory(t.category); };
  const saveEdit = () => {
    if (!editId || !editLabel.trim()) return;
    void run(services.checklistTemplates.update(editId, { label: editLabel.trim(), category: editCategory })).then((ok) => ok && setEditId(null));
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (list: ChecklistTemplate[]) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = list.map((t) => t.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    // optimistic: show the new order now; run() reloads (and so reverts) once the server answers
    setTemplates((all) => [...all.filter((t) => t.jobType !== list[0].jobType), ...next.map((id) => list.find((t) => t.id === id)!)]);
    void run(services.checklistTemplates.reorder(next));
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Job Checklists</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Items listed here are offered to technicians for jobs of that type, and added automatically to new jobs.
          </p>
        </div>
        <Button size="sm" onClick={() => { setJobType(viewType); setAdding(true); }} className="shrink-0"><IconPlus aria-hidden="true" />Add Checklist Item</Button>
      </div>

      {adding && (
        <FormDialog onClose={() => setAdding(false)} onSubmit={add} submitLabel="Add" title="Add Checklist Item" description="Offered to technicians on jobs of the chosen type">
            <div className="space-y-1.5">
              <Label htmlFor="cl-type" className="text-xs">Job type</Label>
              <Select value={jobType} onValueChange={(v) => setJobType(v as JobType)}>
                <SelectTrigger id="cl-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-label" className="text-xs">Checklist item *</Label>
              <Input id="cl-label" required name="label" autoComplete="off" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Checklist item…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <CategorySelect value={category} onChange={setCategory} className="w-full" />
            </div>
          </FormDialog>
      )}

      <Tabs value={viewType} onValueChange={(v) => setViewType(v as JobType)}>
        <TabsList className="flex-wrap h-auto">
          {TYPES.map(([type, title]) => <TabsTrigger key={type} value={type}>{title}<span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{templates.filter((t) => t.jobType === type).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>

      {TYPES.filter(([type]) => type === viewType).map(([type, title]) => {
        const list = templates.filter((t) => t.jobType === type);
        return (
          <Card key={type} className="gap-0 py-4 px-4">
            <h2 className="font-bold text-sm mb-2">{title}</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(list)}>
              <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border text-xs">
              {list.map((t) => (
                <SortableRow key={t.id} id={t.id} editing={editId === t.id}>
                  {(handle) => (<>
                  {editId === t.id ? (
                    <>
                      <Input aria-label="Item label" autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditId(null); }} className="flex-1 min-w-0 h-8 text-xs" />
                      <CategorySelect value={editCategory} onChange={setEditCategory} />
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Save" onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700"><i className="flex text-lg"><IconCheck className="size-[1em]" aria-hidden="true" /></i></Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Cancel" onClick={() => setEditId(null)} className="text-muted-foreground"><i className="flex text-lg"><IconX className="size-[1em]" aria-hidden="true" /></i></Button>
                    </>
                  ) : (
                    <>
                      {handle}
                      <span role="textbox" aria-label="Checklist item text" className="flex-1 min-w-0 break-words p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" contentEditable={true} suppressContentEditableWarning={true} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} onBlur={(e) => {
                        const newLabel = e.currentTarget.textContent?.trim() ?? '';
                        if (newLabel && newLabel !== t.label) {
                          void run(services.checklistTemplates.update(t.id, { label: newLabel }));
                        } else {
                          e.currentTarget.textContent = t.label; // revert to original if empty
                        }
                      }}>
                        {t.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{t.category.replace('_', ' ')}</Badge>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`${t.inactive ? 'Activate' : 'Deactivate'} ${t.label}`} onClick={() => void run(services.checklistTemplates.update(t.id, { inactive: !t.inactive }))} title={t.inactive ? 'Inactive: not offered on new jobs. Click to activate' : 'Deactivate'} className={t.inactive ? 'text-emerald-600 hover:text-emerald-700' : 'text-destructive hover:text-destructive'}><i className="flex text-lg">{t.inactive ? <IconCheck className="size-[1em]" aria-hidden="true" /> : <IconCancel className="size-[1em]" aria-hidden="true" />}</i></Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Edit ${t.label}`} onClick={() => startEdit(t)} title="Edit" className="text-muted-foreground"><i className="flex text-lg"><IconPencil className="size-[1em]" aria-hidden="true" /></i></Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete ${t.label}`} onClick={() => confirmToast(`Delete "${t.label}"?`, () => void run(services.checklistTemplates.remove(t.id)))} title="Delete" className="text-destructive hover:text-destructive"><i className="flex text-lg"><IconTrash className="size-[1em]" aria-hidden="true" /></i></Button>
                    </>
                  )}
                </>)}
                </SortableRow>
              ))}
              {!list.length && <li><EmptyState icon={IconChecklist} compact>No items yet.</EmptyState></li>}
                </ul>
              </SortableContext>
            </DndContext>
          </Card>
        );
      })}
    </div>
  );
};
