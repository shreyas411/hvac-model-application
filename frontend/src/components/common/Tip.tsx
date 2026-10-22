import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip';

/** shadcn tooltip around a single element; renders the child untouched when there's no label. */
export const Tip: React.FC<{ label?: React.ReactNode; children: React.ReactElement }> = ({ label, children }) => {
  if (!label) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
