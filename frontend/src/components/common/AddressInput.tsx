import React, { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/src/components/ui/input';
import { addressSearchEnabled, details, suggest, type PickedAddress, type Suggestion } from '../../utils/places';

interface AddressInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** Called with the whole address when the user picks a suggestion; the parent fills its other fields. */
  onPick: (address: PickedAddress) => void;
}

/** Street-address field with Google address suggestions. Behaves as a plain input when no API key is configured. */
export const AddressInput: React.FC<AddressInputProps> = ({ value, onChange, onPick, className, ...rest }) => {
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const typed = useRef(false); // only search for text the user typed, not for a value set by a pick or by editing a record
  const session = useRef(crypto.randomUUID()); // groups keystrokes and the pick into one billed Google session

  useEffect(() => {
    if (!addressSearchEnabled || !typed.current || value.trim().length < 4) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      suggest(value.trim(), session.current, ctl.signal)
        .then((s) => { setItems(s); setActive(-1); })
        .catch((e) => { if (e.name !== 'AbortError') setItems([]); }); // search is a convenience: a failure leaves a plain input
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value]);

  const pick = async (s: Suggestion) => {
    typed.current = false;
    setItems([]);
    onChange(s.main); // visible straight away; replaced by the full parsed line below
    try { onPick(await details(s.id, session.current)); } catch { /* keep what was typed */ }
    session.current = crypto.randomUUID();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); void pick(items[active]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setItems([]); }
  };

  return (
    <div className="relative">
      <Input
        {...rest}
        type="text" value={value} className={className} autoComplete="off"
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setItems([]), 150)} // after a click on a suggestion has registered
        {...(addressSearchEnabled && { role: 'combobox', 'aria-expanded': items.length > 0, 'aria-controls': listId, 'aria-autocomplete': 'list' as const, 'aria-activedescendant': active >= 0 ? `${listId}-${active}` : undefined })}
      />
      {items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-50 left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-lg overflow-hidden text-xs">
          {items.map((s, i) => (
            <li
              key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); void pick(s); }}
              className={`px-3 py-2 cursor-pointer ${i === active ? 'bg-accent' : 'hover:bg-accent'}`}
            >
              <span className="font-medium">{s.main}</span> <span className="text-muted-foreground">{s.secondary}</span>
            </li>
          ))}
          <li role="presentation" className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border">Powered by Google</li>
        </ul>
      )}
    </div>
  );
};
