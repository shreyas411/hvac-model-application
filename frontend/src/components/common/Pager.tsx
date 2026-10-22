import React, { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { api } from '../../services/api';
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconSelector } from '@tabler/icons-react';
import { TableHead } from '@/src/components/ui/table';
import { cn } from '@/src/lib/utils';

export const PAGE_SIZES = [10, 25, 50, 100];
const KEY = 'apexhvac_page_size';

type Params = Record<string, string | undefined>;

/**
 * Server-side paging for a list endpoint (`?limit=<size>&page=<n>` plus `params` as filters, e.g. `{ q, status }`).
 * `SortHead` column headers drive `?sort=<column>&dir=` (click: asc, again: desc, again: default order). Page size is shared across lists and remembered. Changing a filter or the size returns to page 1.
 * `refresh` is any value that changes when the data does (e.g. the store's list): a new value refetches the current page.
 */
export function useServerPaged<T>(path: string, filters: Params = {}, refresh?: unknown) {
  const [sort, setSort] = useState<{ by: string; dir: 'asc' | 'desc' } | null>(null);
  const params: Params = { ...filters, sort: sort?.by, dir: sort?.dir };
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
  const onSort = (by: string) => setSort(sort?.by !== by ? { by, dir: 'asc' } : sort.dir === 'asc' ? { by, dir: 'desc' } : null);
  return { rows: res.data, total: res.total, loading, error, pager, sort, onSort };
}

const Pager: React.FC<{ page: number; pages: number; size: number; total: number; error: string; onPage: (p: number) => void; onSize: (n: number) => void }> = ({ page, pages, size, total, error, onPage, onSize }) => {
  if (total <= PAGE_SIZES[0] && !error) return null; // everything fits on the smallest page
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border text-xs text-muted-foreground">
      {error ? <span role="alert" className="text-destructive">{error}</span> : <span aria-live="polite">{(page - 1) * size + 1}–{Math.min(total, page * size)} of {total}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1">
          Rows
          <Select value={String(size)} onValueChange={(v) => onSize(Number(v))}>
            <SelectTrigger size="sm" aria-label="Rows per page" className="w-[4.5rem] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </span>
        <Button type="button" variant="outline" size="sm" aria-label="First page" disabled={page <= 1} onClick={() => onPage(1)}><IconChevronsLeft aria-hidden="true" /> First</Button>
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><IconChevronLeft aria-hidden="true" /> Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <IconChevronRight aria-hidden="true" /></Button>
        <Button type="button" variant="outline" size="sm" aria-label="Last page" disabled={page >= pages} onClick={() => onPage(pages)}>Last <IconChevronsRight aria-hidden="true" /></Button>
      </div>
    </nav>
  );
};

/** Sortable column header: `by` is the server column (`relation.column` allowed). Cycles asc → desc → default order. */
export const SortHead: React.FC<{ paged: { sort: { by: string; dir: 'asc' | 'desc' } | null; onSort: (by: string) => void }; by: string; className?: string; children: React.ReactNode }> = ({ paged, by, className, children }) => {
  const active = paged.sort?.by === by ? paged.sort.dir : null;
  const Icon = active === 'asc' ? IconArrowUp : active === 'desc' ? IconArrowDown : IconSelector;
  return (
    <TableHead scope="col" aria-sort={active ? (active === 'asc' ? 'ascending' : 'descending') : undefined} className={className}>
      <button type="button" onClick={() => paged.onSort(by)} className={cn('inline-flex items-center gap-1 hover:text-foreground', className?.includes('text-right') && 'flex-row-reverse')}>
        {children}<Icon aria-hidden="true" className={cn('size-3.5', !active && 'text-muted-foreground')} />
      </button>
    </TableHead>
  );
};
