import React, { useState } from 'react';
import { IconPackage, IconTool } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/src/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { useApp } from '../../context/AppContext';
import { LineItem } from '../../types';
import { formatGBP } from '../../utils/formatters';

type Pick_ = Partial<Pick<LineItem, 'type' | 'description' | 'unitPrice'>>;

/** Searchable catalogue for a quote/invoice line: inventory Parts and Services (labour, call-out) in one list. Typing free text is still allowed in the line's description. */
export const LineItemPicker: React.FC<{ onPick: (patch: Required<Pick_>) => void }> = ({ onPick }) => {
  const { parts, settings } = useApp(['parts', 'settings']);
  const [open, setOpen] = useState(false);
  const choose = (p: Required<Pick_>) => { onPick(p); setOpen(false); };
  const services: Required<Pick_>[] = [
    { type: 'labour', description: 'Labour', unitPrice: settings.defaultHourlyRate },
    { type: 'travel', description: 'Travel / call-out', unitPrice: settings.defaultTravelCharge },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon-sm" title="Pick a part or service" aria-label="Pick a part or service"><IconPackage aria-hidden="true" /></Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search parts and services…" />
          <CommandList>
            <CommandEmpty>No match. Type the description on the line instead.</CommandEmpty>
            <CommandGroup heading="Services">
              {services.map((s) => (
                <CommandItem key={s.description} value={`service ${s.description}`} onSelect={() => choose(s)}>
                  <IconTool className="size-4" aria-hidden="true" /><span className="truncate">{s.description}</span>
                  <span className="ml-auto pl-2 text-[11px] text-muted-foreground tabular-nums">{formatGBP(s.unitPrice)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Parts">
              {parts.filter((p) => !p.inactive).map((p) => (
                <CommandItem key={p.id} value={`part ${p.name} ${p.sku} ${p.category}`} onSelect={() => choose({ type: 'part', description: p.name, unitPrice: p.sellingPrice })}>
                  <IconPackage className="size-4" aria-hidden="true" />
                  <span className="min-w-0"><span className="block truncate">{p.name}</span><span className="block text-[10px] text-muted-foreground">{p.sku} · {p.stockQuantity} in stock</span></span>
                  <span className="ml-auto pl-2 text-[11px] text-muted-foreground tabular-nums">{formatGBP(p.sellingPrice)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
