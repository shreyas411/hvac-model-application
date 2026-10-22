import { create } from 'zustand';

export interface SyncFailure { at: string; method: string; path: string; status: number; detail: string }

/** What the service worker's write queue is holding: writes waiting to send, and writes the server refused after they were queued. */
export const useSyncStore = create<{ pending: number; failures: SyncFailure[] }>(() => ({ pending: 0, failures: [] }));

const tell = (msg: string) => navigator.serviceWorker?.controller?.postMessage(msg);
export const askSyncStatus = () => tell('status');
export const clearSyncFailures = () => tell('clear-failures');
