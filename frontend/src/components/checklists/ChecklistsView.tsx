import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { services } from '../../services';
import { useChecklistTemplates } from '../../data/checklistTemplates';
import { ChecklistTemplate, JobType } from '../../types';
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, CheckSquare, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';

const TYPES: [JobType, string][] = [
  ['installation', 'Installation'],
  ['repair', 'Repair'],
  ['inspection', 'Inspection / CP12 Gas Check'],
  ['emergency_callout', 'Emergency Callout'],
  ['preventive_maintenance', 'Preventive Maintenance'],
];
const CATEGORIES: ChecklistTemplate['category'][] = ['general', 'gas_safety', 'electrical', 'refrigerant'];

const SortableRow: React.FC<{ id: string; editing: boolean; children: (handle: React.ReactNode) => React.ReactNode }> = ({ id, editing, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: editing });
  const handle = (
    <button type="button" aria-label="Drag to reorder" {...attributes} {...listeners} className="text-slate-400 cursor-grab touch-none shrink-0">
      <GripVertical className="w-4 h-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 py-2 bg-white ${isDragging ? 'relative z-10 shadow-md opacity-90' : ''}`}
    >
      {children(handle)}
    </li>
  );
};

/** Admin-only: manage the checklist items offered for each job type. */
export const ChecklistsView: React.FC = () => {
  const { showToast } = useApp();
  const { templates, setTemplates, reload } = useChecklistTemplates();
  const [jobType, setJobType] = useState<JobType>('repair');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<ChecklistTemplate['category']>('general');

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState<ChecklistTemplate['category']>('general');

  const run = (p: Promise<unknown>) => p.then(reload, (e) => showToast(e.message ?? 'Request failed', 'error'));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    void run(services.checklistTemplates.create({ jobType, label: label.trim(), category })).then(() => setLabel(''));
  };

  const startEdit = (t: ChecklistTemplate) => { setEditId(t.id); setEditLabel(t.label); setEditCategory(t.category); };
  const saveEdit = () => {
    if (!editId || !editLabel.trim()) return;
    void run(services.checklistTemplates.update(editId, { label: editLabel.trim(), category: editCategory })).then(() => setEditId(null));
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
    <div className="space-y-5 w-full px-6 py-4">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-sky-700" />
        <h1 className="text-lg font-bold text-slate-900">Job Checklists</h1>
      </div>
      <p className="text-xs text-slate-500">
        Items listed here are offered to technicians for jobs of that type, and added automatically to new jobs.
      </p>

      <form onSubmit={add} className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3 text-xs">
        <select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)} className="border border-slate-300 rounded-md px-2 py-2 bg-white">
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Checklist item" className="flex-1 min-w-96 border border-slate-300 rounded-md px-2 py-2" />
        <select value={category} onChange={(e) => setCategory(e.target.value as ChecklistTemplate['category'])} className="border border-slate-300 rounded-md px-2 py-2 bg-white capitalize">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <button type="submit" className="flex items-center gap-1 px-3 rounded-md bg-sky-700 text-white font-semibold">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </form>

      {TYPES.map(([type, title]) => {
        const list = templates.filter((t) => t.jobType === type);
        return (
          <section key={type} className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-sm text-slate-900 mb-2">{title}</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(list)}>
              <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-slate-100 text-xs">
              {list.map((t) => (
                <SortableRow key={t.id} id={t.id} editing={editId === t.id}>
                  {(handle) => (<>
                  {editId === t.id ? (
                    <>
                      <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="flex-1 border border-slate-300 rounded-md px-2 py-1" />
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as ChecklistTemplate['category'])} className="border border-slate-300 rounded-md px-1 py-1 bg-white capitalize">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                      </select>
                      <button type="button" aria-label="Save" onClick={saveEdit} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                      <button type="button" aria-label="Cancel" onClick={() => setEditId(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      {handle}
                      <span className="flex-1 text-slate-800 p-1" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => {
                        const newLabel = e.currentTarget.textContent?.trim() ?? '';
                        if (newLabel && newLabel !== t.label) {
                          void run(services.checklistTemplates.update(t.id, { label: newLabel }));
                        } else {
                          e.currentTarget.textContent = t.label; // revert to original if empty
                        }
                      }}>
                        {t.label}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">{t.category.replace('_', ' ')}</span>
                      <button type="button" aria-label={`Edit ${t.label}`} onClick={() => startEdit(t)} className="text-slate-400 hover:text-sky-700"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Delete ${t.label}`} onClick={() => void run(services.checklistTemplates.remove(t.id))} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </>)}
                </SortableRow>
              ))}
              {!list.length && <li className="py-2 text-slate-400">No items yet.</li>}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
    </div>
  );
};
