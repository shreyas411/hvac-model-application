import React from 'react';
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog';
import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';

export interface ToastState { text: string; type: 'success' | 'error' | 'info'; onConfirm?: () => void; confirm?: ConfirmOptions }

const STYLE = { error: 'bg-rose-800 border-rose-700', info: 'bg-slate-800 border-slate-700', success: 'bg-emerald-800 border-emerald-700' };

/** Presentational toast; with `onConfirm` it becomes a modal confirm dialog (no timeout, Esc cancels). Usable outside AppProvider. */
export const Toast: React.FC<ToastState & { onDismiss: () => void }> = ({ text, type, onConfirm, confirm, onDismiss }) => onConfirm ? (
  <ConfirmDialog
    description={text} {...confirm}
    destructive={confirm?.destructive ?? /^(delete|remove|void|cancel)\b/i.test(text)} // wording drives the default so existing call sites get red buttons
    confirmLabel={confirm?.confirmLabel ?? (/^delete\b/i.test(text) ? 'Delete' : /^remove\b/i.test(text) ? 'Remove' : 'Confirm')}
    title={confirm?.title ?? (/^delete\b/i.test(text) ? 'Delete?' : 'Are you sure?')}
    onCancel={onDismiss} onConfirm={() => { onDismiss(); onConfirm(); }}
  />
) : (
  <div role={type === 'error' ? 'alert' : 'status'} className="fixed bottom-5 right-5 z-[100] animate-in fade-in slide-in-from-bottom-3 duration-200">
    <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2.5 text-sm font-medium text-white ${STYLE[type]}`}>
      {type === 'error' ? <IconAlertCircle className="w-4 h-4 text-rose-200 shrink-0" aria-hidden="true" />
        : type === 'info' ? <IconInfoCircle className="w-4 h-4 text-sky-200 shrink-0" aria-hidden="true" />
        : <IconCircleCheck className="w-4 h-4 text-emerald-200 shrink-0" aria-hidden="true" />}
      <span>{text}</span>
    </div>
  </div>
);
