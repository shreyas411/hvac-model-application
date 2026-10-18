import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { useDataStore } from './store/useDataStore';
import { refresh, SESSION_EXPIRED } from './services/api';
import { QuoteApprovalPage } from './components/public/QuoteApprovalPage';
import './index.css';

// Service worker owns the write queue; reload lists when it syncs, and nudge it when we come back online.
navigator.serviceWorker?.addEventListener('message', async (e) => {
  if (e.data?.type === 'synced') useDataStore.getState().loadAll();
  if (e.data?.type === 'sync-auth' && (await refresh()) === 'refused') { // refresh() tells the worker to resume the drain
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
});
window.addEventListener('online', () => navigator.serviceWorker?.controller?.postMessage('drain'));

// Customer quote link (/quote/<token>) is public: skip the login gate and the app shell.
const quoteToken = window.location.pathname.match(/^\/quote\/([\w-]+)\/?$/)?.[1];
createRoot(document.getElementById('root')!).render(quoteToken ? <QuoteApprovalPage token={quoteToken} /> : <App />);
