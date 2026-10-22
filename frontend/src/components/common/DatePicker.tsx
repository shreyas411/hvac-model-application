import React, { useState } from 'react';
import { IconCalendar, IconX } from '@tabler/icons-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/src/components/ui/button';
import { Calendar } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { formatDateUK } from '../../utils/formatters';

// Values are local-date ISO strings (YYYY-MM-DD) so a picked day never shifts with the time zone.
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

const Trigger: React.FC<{ id?: string; label: string; placeholder: string; onClear?: () => void }> = ({ id, label, placeholder, onClear }) => (
  <span className="inline-flex items-center">
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" size="sm" className="justify-start font-normal text-xs min-w-36">
        <IconCalendar aria-hidden="true" />
        <span className={label ? '' : 'text-muted-foreground'}>{label || placeholder}</span>
      </Button>
    </PopoverTrigger>
    {label && onClear && <Button type="button" variant="ghost" size="icon-xs" title="Clear" aria-label="Clear date" onClick={onClear}><IconX aria-hidden="true" /></Button>}
  </span>
);

export const DatePicker: React.FC<{ id?: string; value: string; onChange: (iso: string) => void; placeholder?: string; clearable?: boolean; min?: string }> = ({ id, value, onChange, placeholder = 'Pick a date', clearable, min }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Trigger id={id} label={value ? formatDateUK(value) : ''} placeholder={placeholder} onClear={clearable ? () => onChange('') : undefined} />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" disabled={min ? { before: fromISO(min) } : undefined} selected={value ? fromISO(value) : undefined} defaultMonth={value ? fromISO(value) : undefined}
          onSelect={(d) => { if (d) { onChange(toISO(d)); setOpen(false); } }} />
      </PopoverContent>
    </Popover>
  );
};

export interface DateRangeValue { from: string; to: string }

export const DateRangePicker: React.FC<{ value: DateRangeValue; onChange: (v: DateRangeValue) => void; placeholder?: string }> = ({ value, onChange, placeholder = 'Date range' }) => {
  const label = value.from ? `${formatDateUK(value.from)}${value.to ? ` – ${formatDateUK(value.to)}` : ''}` : '';
  const selected: DateRange | undefined = value.from ? { from: fromISO(value.from), to: value.to ? fromISO(value.to) : undefined } : undefined;
  return (
    <Popover>
      <Trigger label={label} placeholder={placeholder} onClear={() => onChange({ from: '', to: '' })} />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="range" numberOfMonths={2} selected={selected} defaultMonth={selected?.from}
          onSelect={(r) => onChange({ from: r?.from ? toISO(r.from) : '', to: r?.to ? toISO(r.to) : '' })} />
      </PopoverContent>
    </Popover>
  );
};
