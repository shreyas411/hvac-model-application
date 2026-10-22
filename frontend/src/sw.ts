import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { Queue } from 'workbox-background-sync';

declare const self: any; // ponytail: DOM lib, not WebWorker, in app tsconfig
const sw = self as any; // the app tsconfig has the DOM lib, not WebWorker
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Tabs are URL paths (/technician_portal, /invoices...): any page navigation gets the cached app shell, so a reload with no signal still opens the app.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));
sw.skipWaiting();
sw.addEventListener('activate', (e: any) => e.waitUntil(sw.clients.claim().then(drain)));

const isApi = (url: URL) => url.pathname.startsWith('/api/v1/');
// Auth calls go straight to the server: queued, a refused refresh re-triggers drain -> 'synced' -> loadAll -> 401 -> refresh forever.
const isWrite = (r: Request) => r.method !== 'GET' && r.method !== 'HEAD' && r.method !== 'OPTIONS' && !new URL(r.url).pathname.startsWith('/api/v1/auth/');

// Reads: network first, cached copy when offline.
registerRoute(({ url, request }) => isApi(url) && request.method === 'GET',
  new NetworkFirst({ cacheName: 'api-cache', plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 })] }));

// Writes: EVERY non-GET api request goes through this queue (persisted in IndexedDB), online or not.
const queue = new Queue('api-writes', { onSync: drain });
const waiting = new Map<string, (r: Response) => void>(); // page callers waiting for the real response

const notify = async (msg: object) => (await sw.clients.matchAll()).forEach((c: any) => c.postMessage(msg));

// Writes the server refused after the page had already been told "saved on this phone" (the job was cancelled meanwhile, a rule changed...).
// Kept in Cache Storage so they are still there if the page was closed, and shown until the user dismisses them.
interface Failure { at: string; method: string; path: string; status: number; detail: string }
const FAILURES = new Request('/__sync-failures');
const readFailures = async (): Promise<Failure[]> => (await (await caches.open('sync-failures')).match(FAILURES))?.json().catch(() => []) ?? [];
const writeFailures = async (list: Failure[]) => (await caches.open('sync-failures')).put(FAILURES, Response.json(list));
const status = async () => ({ type: 'status', pending: (await queue.getAll()).length, failures: await readFailures() });

// Replays FIFO, so a request made online queues behind any offline backlog and only goes out after it.
// Network error/5xx/401 = stop and keep the entry (retried on sync, 'online' message, or next write).
let authAsked = false; // ask the page to refresh once per 401 streak
let draining: Promise<void> | null = null;
let again = false; // a write was queued while a drain was running
function drain(): Promise<void> {
  if (draining) { again = true; return draining; }
  return (draining = (async () => {
    do {
      again = false;
      let e: Awaited<ReturnType<Queue['shiftRequest']>>;
      while ((e = await queue.shiftRequest())) {
        let res: Response;
        try {
          res = await fetch(e.request.clone()); // session cookies ride along (credentials: include), so a refreshed session needs no token hand-off
        } catch {
          // No network: every write the page is waiting on is now safely queued, so say so at once instead of after the 4 s timer below.
          // All of them, not just this one: the entry at the front of the queue is often an older write whose waiter is already gone.
          waiting.forEach((resolve) => resolve(Response.json({ queued: true }, { status: 202 })));
          waiting.clear();
          await queue.unshiftRequest(e);
          break;
        }
        if (res.status >= 500 || res.status === 401) {
          await queue.unshiftRequest(e);
          if (res.status === 401 && !authAsked) { authAsked = true; await notify({ type: 'sync-auth' }); }
          break;
        }
        authAsked = false;
        const id = (e.metadata as { id: string }).id;
        const waiter = waiting.get(id);
        waiter?.(res.clone()); // 2xx and 4xx both end the entry; 4xx surfaces to the caller
        waiting.delete(id);
        if (!waiter && res.status >= 400) { // nobody is waiting for the answer any more (it was queued): record the refusal for the user
          const detail = (await res.clone().json().catch(() => ({})))?.detail ?? res.statusText;
          await writeFailures([...(await readFailures()), { at: new Date().toISOString(), method: e.request.method, path: new URL(e.request.url).pathname.replace('/api/v1', ''), status: res.status, detail }]);
          await notify(await status());
        }
      }
      // Inside the loop, before the `again` check: a drain() that arrives while we are announcing must not be lost (it only sets `again`).
      await notify({ type: 'synced', pending: (await queue.getAll()).length });
    } while (again);
  })().finally(() => { draining = null; }));
}

sw.addEventListener('fetch', (event: any) => {
  const { request } = event;
  if (!isApi(new URL(request.url)) || !isWrite(request)) return;
  event.respondWith((async () => {
    const id = crypto.randomUUID();
    const done = new Promise<Response>((resolve) => waiting.set(id, resolve));
    // stable per request across replays; the backend runs a write once per key
    const headers = new Headers(request.headers);
    headers.set('x-idempotency-key', id);
    await queue.pushRequest({ request: new Request(request, { headers }), metadata: { id } });
    drain();
    // Offline: don't hang the UI. 202 = persisted in the queue, will sync later.
    const queued = new Promise<Response>((r) => setTimeout(() => r(Response.json({ queued: true }, { status: 202 })), 4000));
    return Promise.race([done, queued]);
  })());
});

sw.addEventListener('message', (e: any) => {
  if (e.data === 'drain') { authAsked = false; e.waitUntil(drain()); } // back online, or the session was just refreshed
  if (e.data === 'status') e.waitUntil(status().then(notify)); // a page just opened: tell it what is waiting or was refused
  if (e.data === 'clear-failures') e.waitUntil(writeFailures([]).then(status).then(notify));
});
