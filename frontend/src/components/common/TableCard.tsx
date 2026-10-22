import React, { useLayoutEffect, useRef, useState } from 'react';
import { Card } from '@/src/components/ui/card';

const BOTTOM_GAP = 8;
const MIN_HEIGHT = 240;

/**
 * Standard list container: the table scrolls inside an area sized to the remaining window height
 * (window height - table top - pager height - gap), with a sticky header; the pager (`footer`) stays pinned below.
 * Put `<Table>` as children and `paged.pager` as footer.
 */
export const TableCard: React.FC<{ children: React.ReactNode; footer?: React.ReactNode }> = ({ children, footer }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const measure = () => {
      if (!bodyRef.current) return;
      const top = bodyRef.current.getBoundingClientRect().top + window.scrollY;
      const footerH = footerRef.current?.offsetHeight ?? 0;
      // <main> reserves bottom padding below the page content; subtract it so the page itself never scrolls
      const mainPad = parseFloat(getComputedStyle(document.getElementById('main') ?? document.body).paddingBottom) || 0;
      setHeight(Math.max(MIN_HEIGHT, window.innerHeight - top - footerH - mainPad - BOTTOM_GAP));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure); // toolbar wrapping / pager size changes
    if (footerRef.current) ro.observe(footerRef.current);
    if (bodyRef.current?.parentElement?.parentElement) ro.observe(bodyRef.current.parentElement.parentElement);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
  }, []);

  return (
    <Card className="gap-0 py-0 overflow-hidden rounded-lg shadow-none">
      <div
        ref={bodyRef}
        style={height ? ({ '--table-h': `${height}px` } as React.CSSProperties) : undefined}
        className="[&_[data-slot=table-container]]:max-h-[var(--table-h,60dvh)] [&_[data-slot=table-container]]:overflow-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-muted [&_thead_th]:shadow-[inset_0_-1px_0_var(--border)]"
      >
        {children}
      </div>
      {footer && <div ref={footerRef}>{footer}</div>}
    </Card>
  );
};
