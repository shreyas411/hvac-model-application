import React, { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/src/components/ui/sheet';
import { cn } from '@/src/lib/utils';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Right-side drawer for every create / edit / details screen. Header, scrolling body, sticky footer.
 * With `dirty`, closing asks to discard first. `size`: form = narrow, detail = wide (tabs, tables).
 */
export const DetailDrawer: React.FC<{
  open?: boolean; onClose: () => void; title: React.ReactNode; description?: React.ReactNode;
  size?: 'form' | 'detail'; dirty?: boolean; footer?: React.ReactNode; children: React.ReactNode;
}> = ({ open = true, onClose, title, description, size = 'form', dirty, footer, children }) => {
  const [discarding, setDiscarding] = useState(false);
  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (o) return; if (dirty) setDiscarding(true); else onClose(); }}>
        <SheetContent side="right" className={cn('w-full gap-0', size === 'detail' ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
          <SheetHeader className="bg-muted/50 border-b border-border pr-12">
            <SheetTitle className="text-base">{title}</SheetTitle>
            <SheetDescription className={description ? 'text-xs' : 'sr-only'}>{description ?? 'Details'}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <SheetFooter className="bg-muted/50 border-t border-border flex-row items-center justify-end gap-2">{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
      {discarding && (
        <ConfirmDialog title="Discard changes?" description="You have unsaved changes. Closing now will lose them." confirmLabel="Discard" destructive
          onCancel={() => setDiscarding(false)} onConfirm={() => { setDiscarding(false); onClose(); }} />
      )}
    </>
  );
};
