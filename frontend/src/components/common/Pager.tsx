import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';

export const PAGE_SIZES = [10, 25, 50, 100];
const KEY = 'apexhvac_page_size';

type Params = Record<string, string | undefined>;

/**
 * Server-side paging for a list endpoint (`?limit=<size>&page=<n>` plus `params` as filters, e.g. `{ q, status }`).
 * Page size is shared across lists and remembered. Changing a filter or the size returns to page 1.
 * `refresh` is any value that changes when the data does (e.g. the store's list): a new value refetches the current page.
 */
export function useServerPaged<T>(path: string, params: Params = {}, refresh?: unknown) {
  const [size, setSize] = useState(() => {
    const saved = Number(localStorage.getItem(KEY));
    return PAGE_SIZES.includes(saved) ? saved : PAGE_SIZES[1];
  });
  const key = JSON.stringify([path, params, size]);
  const [at, setAt] = useState({ key, page: 1 });
  const page = at.key === key ? at.page : 1; // a different filter/size key means a fresh page 1
  const [res, setRes] = useState<{ data: T[]; total: number }>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stale = false; // drop responses that a newer request has overtaken
    const t = setTimeout(() => { // debounce typing in search boxes
      setLoading(true);
      const qs = new URLSearchParams({ limit: String(size), page: String(page) });
      for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
      api<{ data: T[]; total: number }>('GET', `${path}?${qs}`).then((r) => {
        if (stale) return;
        if (!r.data.length && page > 1 && r.total) return setAt({ key, page: Math.ceil(r.total / size) }); // rows were removed under the user
        setRes(r);
        setError('');
      }, (e: Error) => { if (!stale) setError(e.message); }).finally(() => { if (!stale) setLoading(false); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [key, page, refresh]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` covers path, params and size

  const pager = (
    <Pager
      page={page}
      pages={Math.max(1, Math.ceil(res.total / size))}
      size={size}
      total={res.total}
      error={error}
      onPage={(p) => setAt({ key, page: p })}
      onSize={(n) => { localStorage.setItem(KEY, String(n)); setSize(n); }}
    />
  );
  return { rows: res.data, total: res.total, loading, error, pager };
}

const btn = 'inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

const Pager: React.FC<{ page: number; pages: number; size: number; total: number; error: string; onPage: (p: number) => void; onSize: (n: number) => void }> = ({ page, pages, size, total, error, onPage, onSize }) => {
  if (total <= PAGE_SIZES[0] && !error) return null; // everything fits on the smallest page
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 text-xs text-slate-500">
      {error ? <span role="alert" className="text-rose-700">{error}</span> : <span aria-live="polite">{(page - 1) * size + 1}–{Math.min(total, page * size)} of {total}</span>}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          Rows
          <select aria-label="Rows per page" value={size} onChange={(e) => onSize(Number(e.target.value))} className="border border-slate-200 rounded px-1.5 py-1 bg-white">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className={btn} aria-label="First page" disabled={page <= 1} onClick={() => onPage(1)}><IconChevronsLeft className="w-3.5 h-3.5" aria-hidden="true" /> First</button>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}><IconChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <IconChevronRight className="w-3.5 h-3.5" aria-hidden="true" /></button>
        <button type="button" className={btn} aria-label="Last page" disabled={page >= pages} onClick={() => onPage(pages)}>Last <IconChevronsRight className="w-3.5 h-3.5" aria-hidden="true" /></button>
      </div>
    </nav>
  );
};
