import React, { useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Ask for a reason (replaces `prompt()`); the text is passed to `onConfirm`. */
  reason?: { label: string; required?: boolean };
}

interface Props extends ConfirmOptions {
  description: React.ReactNode;
  onConfirm: (reason: string) => void | Promise<unknown>;
  onCancel: () => void;
}

/** Centered confirm dialog for every delete / void / discard. Cancel has default focus; Esc cancels. */
export const ConfirmDialog: React.FC<Props> = ({ title = 'Are you sure?', description, confirmLabel = 'Confirm', destructive, reason, onConfirm, onCancel }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = busy || (!!reason?.required && !text.trim());
  const run = async () => { setBusy(true); try { await onConfirm(text.trim()); } finally { setBusy(false); } };
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason && (
          <div className="space-y-1.5 text-xs">
            <label htmlFor="confirm-reason" className="font-semibold">{reason.label}{reason.required && ' *'}</label>
            <Textarea id="confirm-reason" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={blocked} onClick={run}>{busy ? 'Working…' : confirmLabel}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
