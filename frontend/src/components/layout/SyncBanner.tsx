import React, { useSyncExternalStore } from 'react';
import { IconAlertCircle, IconCloudOff, IconRefresh } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Button } from '@/src/components/ui/button';
import { clearSyncFailures, useSyncStore, type SyncFailure } from '../../store/useSyncStore';

const online = (cb: () => void) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };

const NOUN: Record<string, string> = { jobs: 'job', customers: 'customer', invoices: 'invoice', quotations: 'quotation', equipment: 'asset', requests: 'service request', certificates: 'certificate', technicians: 'engineer', inventory: 'part', parts: 'part' };
const describe = (f: SyncFailure) => {
  const [, kind = '', , tail] = f.path.split('/');
  const noun = NOUN[kind] ?? 'record';
  return f.method === 'POST' && tail === 'status' ? `${noun} status change` : f.method === 'POST' ? `new ${noun}` : `${noun} edit`;
};

/** Shown while changes are waiting to send, and when one the server refused after it was saved on the phone. */
export const SyncBanner: React.FC = () => {
  const { pending, failures } = useSyncStore();
  const isOnline = useSyncExternalStore(online, () => navigator.onLine);
  if (!pending && !failures.length) return null;
  return (
    <div className="no-print">
      {failures.length > 0 && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0 bg-destructive/5 px-4 sm:px-6 py-2.5 text-xs flex items-start gap-3">
          <IconAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" />
          <AlertDescription className="flex-1 space-y-0.5 text-destructive">
            <p className="font-semibold">{failures.length === 1 ? 'A change you made offline was not accepted' : `${failures.length} changes you made offline were not accepted`}. Check these and redo them if needed.</p>
            <ul className="list-disc pl-4">{failures.map((f, i) => <li key={i}>{describe(f)}: {f.detail}</li>)}</ul>
          </AlertDescription>
          <Button variant="link" size="xs" onClick={clearSyncFailures} className="text-destructive shrink-0">Dismiss</Button>
        </Alert>
      )}
      {pending > 0 && (
        <Alert className="rounded-none border-x-0 border-t-0 border-amber-200 bg-amber-50 px-4 sm:px-6 py-2 text-xs text-amber-900 flex items-center gap-2">
          {isOnline ? <IconRefresh className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" /> : <IconCloudOff className="w-4 h-4 shrink-0" aria-hidden="true" />}
          <span>
            {isOnline
              ? <>Sending {pending} saved {pending === 1 ? 'change' : 'changes'}…</>
              : <><strong>No signal.</strong> {pending} {pending === 1 ? 'change is' : 'changes are'} saved on this phone and will send automatically when you are back online.</>}
          </span>
        </Alert>
      )}
    </div>
  );
};
