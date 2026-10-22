import React, { useState } from 'react';
import { IconCheck, IconSelector } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/src/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { cn } from '@/src/lib/utils';

export interface ComboOption { value: string; label: string; hint?: string; group?: string }

/** Searchable select for long lists (customers, parts, technicians). Use `Select` for short fixed lists. */
export const Combobox: React.FC<{
  id?: string; options: ComboOption[]; value: string; onChange: (value: string) => void;
  placeholder?: string; searchPlaceholder?: string; className?: string;
}> = ({ id, options, value, onChange, placeholder = 'Select…', searchPlaceholder = 'Search…', className }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const groups = [...new Set(options.map((o) => o.group ?? ''))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className={cn('w-full justify-between font-normal', className)}>
          <span className={cn('truncate', !current && 'text-muted-foreground')}>{current?.label ?? placeholder}</span>
          <IconSelector className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g} heading={g || undefined}>
                {options.filter((o) => (o.group ?? '') === g).map((o) => (
                  <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ''}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <IconCheck className={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="ml-auto pl-2 text-[11px] text-muted-foreground tabular-nums">{o.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
