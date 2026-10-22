import React from 'react';
import type { Icon } from '@tabler/icons-react';
import { IconDotsVertical } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { cn } from '@/src/lib/utils';

export interface RowAction { icon: Icon; label: string; onClick: () => void; destructive?: boolean; tone?: 'success' | 'info'; hidden?: boolean }

const TONE = { destructive: 'text-destructive hover:text-destructive', success: 'text-emerald-600 hover:text-emerald-700', info: 'text-blue-600 hover:text-blue-700', none: 'text-muted-foreground hover:text-foreground' };
const toneOf = (a: RowAction) => TONE[a.destructive ? 'destructive' : a.tone ?? 'none'];

/** Icon-only table actions: first three inline (title on hover), the rest in a ⋮ menu. List order: view, edit, delete, then extras. */
export const RowActions: React.FC<{ actions: RowAction[]; subject: string }> = ({ actions, subject }) => {
  const shown = actions.filter((a) => !a.hidden);
  const inline = shown.slice(0, 3);
  const more = shown.slice(3);
  return (
    <div className="flex items-center justify-end gap-0.5">
      {inline.map((a) => (
        <Button key={a.label} type="button" variant="ghost" size="icon-xs" title={a.label} aria-label={`${a.label} ${subject}`} onClick={a.onClick}
          className={cn(toneOf(a))}>
          <i className="flex text-lg"><a.icon className="size-[1em]" aria-hidden="true" /></i>
        </Button>
      ))}
      {more.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" title="More actions" aria-label={`More actions for ${subject}`} className="text-muted-foreground"><i className="flex text-lg"><IconDotsVertical className="size-[1em]" aria-hidden="true" /></i></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {more.map((a, i) => (
              <React.Fragment key={a.label}>
                {a.destructive && i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem variant={a.destructive ? 'destructive' : 'default'} onSelect={a.onClick}><a.icon className={a.tone && !a.destructive ? toneOf(a) : undefined} aria-hidden="true" />{a.label}</DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
