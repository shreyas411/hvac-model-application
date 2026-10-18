import React from 'react';
import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';

export interface ToastState { text: string; type: 'success' | 'error' | 'info'; onConfirm?: () => void }

const STYLE = { error: 'bg-rose-900 border-rose-800', info: 'bg-slate-900 border-slate-800', success: 'bg-emerald-800 border-emerald-700' };

/** Presentational toast; with `onConfirm` it shows Confirm/Cancel buttons. Usable outside AppProvider. */
export const Toast: React.FC<ToastState & { onDismiss: () => void }> = ({ text, type, onConfirm, onDismiss }) => (
  <div role={type === 'error' ? 'alert' : 'status'} className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
    <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2.5 text-xs font-semibold text-white ${STYLE[type]}`}>
      {type === 'error' ? <IconAlertCircle className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
        : type === 'info' ? <IconInfoCircle className="w-4 h-4 text-sky-300 shrink-0" aria-hidden="true" />
        : <IconCircleCheck className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />}
      <span>{text}</span>
      {onConfirm && (
        <>
          <button type="button" onClick={() => { onDismiss(); onConfirm(); }} className="ml-2 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500">Confirm</button>
          <button type="button" onClick={onDismiss} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Cancel</button>
        </>
      )}
    </div>
  </div>
);
