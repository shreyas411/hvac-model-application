import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { useDataStore } from './store/useDataStore';
import { askSyncStatus, useSyncStore } from './store/useSyncStore';
import { refresh, SESSION_EXPIRED } from './services/api';
import { QuoteApprovalPage } from './components/public/QuoteApprovalPage';
import { installInlineValidation } from './utils/inlineValidation';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';

installInlineValidation();

// Service worker owns the write queue; reload lists when it syncs, and nudge it when we come back online.
navigator.serviceWorker?.addEventListener('message', async (e) => {
  if (e.data?.type === 'synced') useSyncStore.setState({ pending: e.data.pending ?? 0 });
  if (e.data?.type === 'status') useSyncStore.setState({ pending: e.data.pending ?? 0, failures: e.data.failures ?? [] });
  // Reload only once the queue is empty: with writes still waiting (no signal) the lists come from the offline cache and would undo what the screen just showed.
  if (e.data?.type === 'synced' && !e.data.pending) useDataStore.getState().loadAll();
  if (e.data?.type === 'sync-auth' && (await refresh()) === 'refused') { // refresh() tells the worker to resume the drain
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
});
window.addEventListener('online', () => navigator.serviceWorker?.controller?.postMessage('drain'));
navigator.serviceWorker?.ready.then(askSyncStatus); // a page opened (or reloaded) with changes still waiting, or refused while it was closed

// A new build installs and takes over (sw.ts skipWaiting + claim) while this page still runs the old one it loaded from cache.
// Reload once if that happens right after opening, before there is anything to lose; later updates apply on the next open.
// ponytail: a worker that takes over mid-session never forces a reload (a half-drawn signature must survive); add an "update ready" prompt if stale tabs become a problem.
const hadWorker = !!navigator.serviceWorker?.controller;
const openedAt = Date.now();
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (hadWorker && Date.now() - openedAt < 10_000) window.location.reload();
});

// Customer quote link (/quote/<token>) is public: skip the login gate and the app shell.
const quoteToken = window.location.pathname.match(/^\/quote\/([\w-]+)\/?$/)?.[1];
createRoot(document.getElementById('root')!).render(<TooltipProvider>{quoteToken ? <QuoteApprovalPage token={quoteToken} /> : <App />}</TooltipProvider>);
