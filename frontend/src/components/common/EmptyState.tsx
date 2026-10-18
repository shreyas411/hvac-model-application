import React from 'react';
import type { Icon } from '@tabler/icons-react';

/** Icon + message for lists with nothing to show; `compact` for small inline lists. */
export const EmptyState = ({ icon: Icon, compact, children }: { icon: Icon; compact?: boolean; children: React.ReactNode }) =>
  compact ? (
    <p className="flex items-center gap-2 py-2 text-slate-400"><Icon className="w-4 h-4 shrink-0" aria-hidden="true" />{children}</p>
  ) : (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-slate-400 text-xs"><Icon className="w-8 h-8 text-slate-300" aria-hidden="true" />{children}</div>
  );
