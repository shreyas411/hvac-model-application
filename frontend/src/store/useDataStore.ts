import { create } from 'zustand';
import { services } from '../services';

type Key = 'technicians' | 'customers' | 'equipment' | 'requests' | 'jobs' | 'quotations' | 'invoices' | 'parts' | 'movements' | 'notifications';
type Row<K extends Key> = Awaited<ReturnType<(typeof services)[K]['list']>>[number];

interface DataStore {
  data: { [K in Key]: Row<K>[] };
  loading: Partial<Record<Key, boolean>>;
  error: string | null;
  /** Fetch every list (e.g. after the active user changes). */
  loadAll: () => Promise<void>;
  /** Fetch a list into the store. */
  load: <K extends Key>(key: K) => Promise<void>;
  /** Run a service call, merge the returned row into the store, surface errors. */
  run: <K extends Key, R extends { id: string } | void>(key: K, call: () => Promise<R>) => Promise<R>;
}

const empty = { technicians: [], customers: [], equipment: [], requests: [], jobs: [], quotations: [], invoices: [], parts: [], movements: [], notifications: [] };

export const useDataStore = create<DataStore>((set, get) => ({
  data: empty,
  loading: {},
  error: null,
  loadAll: async () => {
    await Promise.all((Object.keys(empty) as Key[]).map((k) => get().load(k)));
  },
  load: async (key) => {
    set((s) => ({ loading: { ...s.loading, [key]: true }, error: null }));
    try {
      const rows = await (services[key].list as () => Promise<any[]>)();
      set((s) => ({ data: { ...s.data, [key]: rows } }));
    } catch (e) {
      // a role without access (403) must not keep showing the previous user's rows
      set((s) => ({ data: { ...s.data, [key]: [] }, error: (e as Error).message }));
    } finally {
      set((s) => ({ loading: { ...s.loading, [key]: false } }));
    }
  },
  run: async (key, call) => {
    console.log(`%c[STORE-DEBUG] 🔵 Starting run for key: ${key}`, 'color: #007bff; font-weight: bold;');
    try {
      console.log('%c[STORE-DEBUG] ⚙️ Executing service call...', 'color: #007bff;');
      const row = await call();
      console.log('%c[STORE-DEBUG] ✅ Call successful, updating state', 'color: #28a745; font-weight: bold;');
      if (row) set((s) => {
        const rows = s.data[key] as { id: string }[];
        const next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [row, ...rows];
        return { data: { ...s.data, [key]: next }, error: null };
      });
      return row;
    } catch (e) {
      console.error('%c[STORE-DEBUG] ❌ Call failed:', 'color: #dc3545; font-weight: bold;', e);
      set({ error: (e as Error).message });
      throw e;
    }
  },
}));
