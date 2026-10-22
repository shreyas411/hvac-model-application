import React, { useEffect, useRef, useState } from 'react';
import { IconEraser } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';

/** Touch/mouse signature canvas. `onChange` gets a PNG data URL, or null while empty. */
export const SignaturePad: React.FC<{ onChange: (dataUrl: string | null) => void }> = ({ onChange }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [inked, setInked] = useState(false);

  // Match the backing store to the displayed size so strokes aren't blurry or offset.
  // Resizing resets the canvas, so the existing strokes are snapshotted and redrawn scaled to the new size.
  useEffect(() => {
    const c = ref.current!;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      if (c.width === Math.round(c.clientWidth * ratio) && c.height === Math.round(c.clientHeight * ratio)) return;
      const snapshot = document.createElement('canvas');
      snapshot.width = c.width;
      snapshot.height = c.height;
      snapshot.getContext('2d')!.drawImage(c, 0, 0);
      c.width = c.clientWidth * ratio;
      c.height = c.clientHeight * ratio;
      const g = c.getContext('2d')!;
      if (snapshot.width) g.drawImage(snapshot, 0, 0, c.width, c.height);
      g.scale(ratio, ratio);
      Object.assign(g, { lineWidth: 2.5, lineCap: 'round', lineJoin: 'round', strokeStyle: '#0f172a' });
      setInked((was) => { if (was) onChange(c.toDataURL('image/png')); return was; }); // keep the saved image in step with the redraw
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange is only used to report the reset
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const g = ref.current!.getContext('2d')!;
    g.beginPath();
    g.moveTo(...pos(e));
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const g = ref.current!.getContext('2d')!;
    g.lineTo(...pos(e));
    g.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setInked(true);
    onChange(ref.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setInked(false);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        aria-label="Customer signature"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="w-full h-32 bg-muted/50 border border-dashed border-input rounded-lg touch-none cursor-crosshair"
      />
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
        <span aria-live="polite">{inked ? 'Signature captured' : 'Sign above with finger or mouse'}</span>
        <Button type="button" variant="ghost" size="xs" onClick={clear} className="-my-2"><IconEraser aria-hidden="true" /> Clear</Button>
      </div>
    </div>
  );
};
