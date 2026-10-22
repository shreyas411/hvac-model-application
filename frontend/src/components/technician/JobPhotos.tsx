import React, { useEffect, useState, useRef } from 'react';
import { EmptyState } from '../common/EmptyState';
import { IconPhoto } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { services } from '../../services';
import type { JobPhoto } from '../../services';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

/** Longest edge 1600px, WebP: a phone photo drops from ~4MB to ~200KB. Steps quality down if still over the server's 600KB cap. */
async function shrink(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.8, 0.6, 0.4]) {
    const url = c.toDataURL('image/webp', q);
    if (url.length * 0.75 < 580_000) return url;
  }
  throw new Error('Photo is too detailed to compress under 600 KB');
}

const Thumb: React.FC<{ jobId: string; photo: JobPhoto; onRemove?: () => void }> = ({ jobId, photo, onRemove }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    void services.jobs.photoBlob(jobId, photo.id).then((b) => setSrc((url = URL.createObjectURL(b))), () => {});
    return () => URL.revokeObjectURL(url);
  }, [jobId, photo.id]);
  return (
    <figure className="relative border border-border rounded-lg overflow-hidden bg-muted/50">
      {src ? <img src={src} alt={photo.caption || 'Job photo'} className="w-full h-28 object-cover" /> : <div className="h-28" />}
      {photo.caption && <figcaption className="px-2 py-1 text-[10px] text-muted-foreground truncate">{photo.caption}</figcaption>}
      {onRemove && <Button type="button" variant="outline" size="icon-sm" onClick={onRemove} aria-label="Remove photo" className="absolute top-1 right-1 size-9 bg-white/90 text-lg font-bold text-destructive"><span aria-hidden="true">×</span></Button>}
    </figure>
  );
};

export const JobPhotos: React.FC<{ jobId: string; locked?: boolean }> = ({ jobId, locked }) => {
  const { showToast, confirmToast } = useApp(['showToast', 'confirmToast']);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const seq = useRef(0);
  const load = () => { // ignore a slow response for a previous job so one job never shows another's photos
    const id = ++seq.current;
    return services.jobs.photos(jobId).then((p) => { if (id === seq.current) setPhotos(p); }, (e: Error) => { if (navigator.onLine) showToast(e.message, 'error'); }); // no signal: the list simply can't load, a raw "Failed to fetch" helps nobody
  };
  useEffect(() => { void load(); }, [jobId]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    setBusy(true);
    try {
      for (const f of files) await services.jobs.addPhoto(jobId, await shrink(f), caption);
      setCaption('');
      await load();
    } catch (err) { showToast((err as Error).message, 'error'); }
    setBusy(false);
  };
  const remove = (id: string) => services.jobs.removePhoto(jobId, id).then(load, (e: Error) => showToast(e.message, 'error'));

  return (
    <Card className="gap-0 py-4 px-4 sm:p-5 space-y-3">
      <h3 className="font-bold text-sm">Job Photos ({photos.length})</h3>
      {!locked && (
        <div className="flex flex-col sm:flex-row gap-2 text-xs">
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" aria-label="Photo caption" maxLength={200} className="flex-1" />
          <label className={cn('px-3 py-2 rounded-md font-semibold text-center cursor-pointer focus-within:ring-2 focus-within:ring-ring', busy ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}>
            {busy ? 'Uploading…' : 'Take / add photo'}
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" disabled={busy} onChange={(e) => void pick(e)} />
          </label>
        </div>
      )}
      {photos.length === 0 ? <EmptyState icon={IconPhoto} compact>No photos yet.</EmptyState> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((p) => <Thumb key={p.id} jobId={jobId} photo={p} onRemove={locked ? undefined : () => confirmToast('Delete this photo?', () => void remove(p.id))} />)}
        </div>
      )}
    </Card>
  );
};
