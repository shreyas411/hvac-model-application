import React from 'react';
import { CustomFieldDefinition, CustomFieldValues } from '../../types';
import { formatDateUK } from '../../utils/formatters';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { DatePicker } from './DatePicker';

/** Form inputs for admin-defined fields; `values` is keyed by definition id. Renders nothing when there are none. */
export const CustomFieldInputs: React.FC<{ defs: CustomFieldDefinition[]; values: CustomFieldValues; onChange: (v: CustomFieldValues) => void }> = ({ defs, values, onChange }) => {
  const set = (id: string, v: string | number | boolean | undefined) => { const next = { ...values }; if (v === undefined || v === '') delete next[id]; else next[id] = v; onChange(next); };
  if (!defs.length) return null;
  return (
    <section className="space-y-3 pt-1">
      <h3 className="font-bold text-foreground uppercase tracking-wide border-b border-border pb-1">Custom fields</h3>
      {defs.map((d) => {
        const id = `cf-${d.id}`, v = values[d.id];
        if (d.type === 'checkbox') return <Label key={d.id} className="pt-1 text-xs font-normal"><Checkbox checked={v === true} onCheckedChange={(c) => set(d.id, c === true)} />{d.label}</Label>;
        return (
          <div key={d.id} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs">{d.label}{d.required && ' *'}</Label>
            {d.type === 'select' ? (
              <Select value={typeof v === 'string' ? v : ''} onValueChange={(x) => set(d.id, x)}>
                <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{d.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : d.type === 'date' ? (
              <div><DatePicker id={id} value={typeof v === 'string' ? v : ''} onChange={(x) => set(d.id, x)} clearable /></div>
            ) : d.type === 'number' ? (
              <Input id={id} type="number" step="any" required={d.required} value={v === undefined ? '' : String(v)} onChange={(e) => set(d.id, e.target.value === '' ? undefined : Number(e.target.value))} />
            ) : (
              <Input id={id} required={d.required} autoComplete="off" value={typeof v === 'string' ? v : ''} onChange={(e) => set(d.id, e.target.value)} />
            )}
          </div>
        );
      })}
    </section>
  );
};

/** Read-only label/value lines for every field; an empty one shows a dash (an unticked checkbox shows "No"). */
export const CustomFieldList: React.FC<{ defs: CustomFieldDefinition[]; values?: CustomFieldValues }> = ({ defs, values = {} }) => (
  <>{defs.map((d) => {
    const v = values[d.id];
    return <p key={d.id}><strong>{d.label}:</strong> {d.type === 'checkbox' ? (v === true ? 'Yes' : 'No') : v === undefined ? '—' : d.type === 'date' ? formatDateUK(String(v)) : String(v)}</p>;
  })}</>
);

/** Titled box for detail drawers: lists every field, with or without a value. Renders nothing when the module has no fields. */
export const CustomFieldBox: React.FC<{ defs: CustomFieldDefinition[]; values?: CustomFieldValues }> = ({ defs, values = {} }) => {
  if (!defs.length) return null;
  return (
    <section className="space-y-1.5 text-xs">
      <h3 className="font-bold text-foreground uppercase tracking-wide border-b border-border pb-1">Custom fields</h3>
      <CustomFieldList defs={defs} values={values} />
    </section>
  );
};
