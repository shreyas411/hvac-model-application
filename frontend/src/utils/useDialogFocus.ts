import { useEffect } from 'react';

const DIALOG = '[role="dialog"][aria-modal="true"]';
const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Focus management for every modal dialog in the app (call once, in App): focus moves into a dialog
 * when it opens, Tab is trapped inside the topmost one, and focus returns to the opener on close.
 * Dialogs only need `role="dialog" aria-modal="true"` on their overlay.
 */
export function useDialogFocus() {
  useEffect(() => {
    const top = () => [...document.querySelectorAll<HTMLElement>(DIALOG)].pop();
    const focusables = (d: HTMLElement) => [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    let current: HTMLElement | undefined;
    let opener: HTMLElement | null = null;
    let last: HTMLElement | null = null; // last focused control inside the dialog

    const sync = () => {
      const d = top();
      if (d === current) {
        // A busy guard disabled the focused button: focus fell to <body>. Keep it in the dialog, and hand it back once re-enabled.
        const a = document.activeElement;
        if (d && (a === document.body || a === d)) {
          if (last?.isConnected && d.contains(last) && !(last as HTMLButtonElement).disabled) last.focus();
          else if (a === document.body) { d.tabIndex = -1; d.focus(); }
        }
        return;
      }
      if (d && !current) opener = document.activeElement as HTMLElement | null;
      if (d && !d.contains(document.activeElement)) {
        d.tabIndex = -1;
        (focusables(d)[0] ?? d).focus();
      }
      if (!d) opener?.focus?.();
      current = d;
    };
    // Dialogs mount inline all over the app, so observe the whole body but only re-sync when a dialog appears/disappears,
    // or a `disabled` flip happens while one is open. Everything else (toasts, list renders) is skipped.
    const hasDialog = (n: Node) => n instanceof HTMLElement && (n.matches(DIALOG) || !!n.querySelector(DIALOG));
    const observer = new MutationObserver((records) => {
      if (records.some((r) => (r.type === 'attributes' ? !!current : [...r.addedNodes, ...r.removedNodes].some(hasDialog)))) sync();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    const onFocusIn = (e: FocusEvent) => { const d = top(); if (d && e.target instanceof HTMLElement && d.contains(e.target) && e.target !== d) last = e.target; };
    document.addEventListener('focusin', onFocusIn);

    const onKey = (e: KeyboardEvent) => {
      const d = e.key === 'Tab' ? top() : undefined;
      if (!d) return;
      const f = focusables(d);
      if (!f.length) return e.preventDefault();
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && (document.activeElement === first || !d.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !d.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { observer.disconnect(); document.removeEventListener('focusin', onFocusIn); document.removeEventListener('keydown', onKey); };
  }, []);
}
