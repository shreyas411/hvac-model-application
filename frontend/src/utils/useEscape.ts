import { useEffect } from 'react';

/** Calls `onEscape` when Escape is pressed while `active` (e.g. a modal is open). */
export const useEscape = (active: boolean, onEscape: () => void) => {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
};
