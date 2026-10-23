import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';

interface Props {
  title: React.ReactNode;
  description?: React.ReactNode;
  submitLabel: string;
  destructive?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Extra footer buttons before submit */
  actions?: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  children: React.ReactNode;
}

/** Centered popup form for short (under 4 fields) inputs; longer forms use DetailDrawer. */
export const FormDialog: React.FC<Props> = ({ title, description, submitLabel, destructive, busy, disabled, actions, onSubmit, onClose, children }) => (
  <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={onSubmit} className="grid gap-4 text-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          {actions}
          <Button type="submit" size="sm" variant={destructive ? 'destructive' : 'default'} disabled={busy || disabled}>{submitLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);
