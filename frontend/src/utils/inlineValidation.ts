/**
 * Replaces the browser's transient validation tooltip with a persistent message under the field (all forms, one listener).
 * Native constraint checking still blocks submit; we only change how the failure is shown.
 */
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const clear = (f: Field) => { f.removeAttribute('aria-invalid'); f.parentElement?.querySelectorAll(`[data-invalid-for="${f.id || f.name || ''}"]`).forEach((n) => n.remove()); };

/** Says what to do and names the field, e.g. "Enter email address", instead of the browser's generic text. */
function messageFor(f: Field) {
  const name = (f.labels?.[0]?.textContent ?? '').replace(/\*/g, '').trim().split(/\s+/).map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase())).join(' '); // keep acronyms (UK) as written
  if (f.validity.valueMissing && name) return f instanceof HTMLSelectElement ? `Choose ${name}` : `Enter ${name}`;
  if (f.validity.typeMismatch && f.type === 'email') return 'Enter a valid email address, like name@example.co.uk';
  return f.validationMessage;
}

export function installInlineValidation() {
  document.addEventListener('invalid', (e) => {
    const f = e.target as Field;
    e.preventDefault(); // suppress the native bubble
    clear(f);
    f.setAttribute('aria-invalid', 'true');
    const msg = Object.assign(document.createElement('p'), { className: 'text-rose-700 text-xs font-medium mt-1', textContent: messageFor(f) });
    msg.setAttribute('role', 'alert');
    msg.dataset.invalidFor = f.id || f.name || '';
    f.insertAdjacentElement('afterend', msg);
    if (!f.form?.querySelector('[aria-invalid="true"]:focus')) (f.form?.querySelector('[aria-invalid="true"]') as Field | null)?.focus();
    const done = () => { clear(f); f.removeEventListener('input', done); f.removeEventListener('change', done); };
    f.addEventListener('input', done); f.addEventListener('change', done);
  }, true);
}
