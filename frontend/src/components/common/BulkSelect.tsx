import React, { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { TableCell, TableHead } from '@/src/components/ui/table';

/**
 * Row selection for a paged list. Selection is limited to the rows on screen: ids that leave the page (filter, paging, deletion) drop out of `selected`.
 * `canSelect` excludes rows an action can't apply to (e.g. closed jobs); they get a disabled checkbox and are skipped by select-all.
 * Use `<SelectAllHead>` / `<SelectCell>` in the table and `<BulkBar>` for the actions.
 */
export function useRowSelection<T extends { id: string }>(rows: T[], canSelect: (row: T) => boolean = () => true) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const pickable = rows.filter(canSelect);
  const selected = pickable.filter((r) => ids.has(r.id));
  return {
    selected,
    has: (id: string) => ids.has(id),
    canSelect,
    all: pickable.length > 0 && selected.length === pickable.length,
    some: selected.length > 0,
    toggle: (id: string, on: boolean) => setIds((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; }),
    toggleAll: (on: boolean) => setIds(on ? new Set(pickable.map((r) => r.id)) : new Set()),
    clear: () => setIds(new Set()),
  };
}

export type RowSelection<T extends { id: string }> = ReturnType<typeof useRowSelection<T>>;

/** Header checkbox cell: checked when every selectable row is picked, dash when only some are. */
export function SelectAllHead<T extends { id: string }>({ sel, label }: { sel: RowSelection<T>; label: string }) {
  return (
    <TableHead className="w-8">
      <Checkbox aria-label={`Select all ${label} on this page`} checked={sel.all ? true : sel.some ? 'indeterminate' : false} onCheckedChange={(v) => sel.toggleAll(v === true)} />
    </TableHead>
  );
}

/** Row checkbox cell. `label` names the row for screen readers, e.g. the invoice number. */
export function SelectCell<T extends { id: string }>({ sel, row, label }: { sel: RowSelection<T>; row: T; label: string }) {
  return (
    <TableCell>
      <Checkbox aria-label={`Select ${label}`} disabled={!sel.canSelect(row)} checked={sel.has(row.id)} onCheckedChange={(v) => sel.toggle(row.id, v === true)} />
    </TableCell>
  );
}

/** Floating action bar shown while rows are selected. Put the action buttons / selects as children. */
export const BulkBar: React.FC<{ count: number; onClear: () => void; children?: React.ReactNode }> = ({ count, onClear, children }) => {
  if (!count) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-neutral-900 text-neutral-50 px-4 py-2.5 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-4" role="region" aria-label="Bulk actions">
      <strong className="tabular-nums">{count} selected</strong>
      {children}
      <Button type="button" variant="ghost" size="xs" className="text-neutral-50 hover:bg-white/15 hover:text-white" onClick={onClear}><IconX aria-hidden="true" />Clear</Button>
    </div>
  );
};
