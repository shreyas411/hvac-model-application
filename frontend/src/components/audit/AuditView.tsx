import React, { useState } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import type { AuditEntry } from '../../services';
import { SortHead, useServerPaged } from '../common/Pager';
import { TableCard } from '../common/TableCard';
import { formatDateTimeUK } from '../../utils/formatters';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';

export const AuditView: React.FC = () => {
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const paged = useServerPaged<AuditEntry>('/audit', { q: q.trim() || undefined, entity: entity || undefined });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="pb-2 border-b border-border">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight">Audit Log</h1>
          <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'entry' : 'entries'}`}>{paged.total}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Append-only record of quotation, invoice, payment, credit and compliance actions</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="search" name="q" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entity, action, user, details…" aria-label="Search audit log" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={entity || 'all'} onValueChange={(v) => setEntity(v === 'all' ? '' : v)}>
          <SelectTrigger aria-label="Filter by entity" size="sm" className="w-40 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {['quotation', 'invoice', 'job', 'certificate', 'data'].map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {(q || entity) && <Button variant="ghost" size="xs" onClick={() => { setQ(''); setEntity(''); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      <div style={{ '--table-offset': '15rem' } as React.CSSProperties}>
        <TableCard footer={paged.pager}>
          <Table className="w-full text-left text-xs">
            <TableHeader>
              <TableRow>
                <SortHead paged={paged} by="createdAt" className="py-2.5 px-3">When</SortHead>
                <SortHead paged={paged} by="userName" className="py-2.5 px-3">User</SortHead>
                <SortHead paged={paged} by="entity" className="py-2.5 px-3">Entity</SortHead>
                <SortHead paged={paged} by="action" className="py-2.5 px-3">Action</SortHead>
                <TableHead scope="col" className="py-2.5 px-3">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.rows.length === 0 && !paged.loading && <TableRow><TableCell colSpan={5} className="py-4 px-3 text-center text-muted-foreground">No entries</TableCell></TableRow>}
              {paged.rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="py-2.5 px-3 tabular-nums whitespace-nowrap">{formatDateTimeUK(a.timestamp)}</TableCell>
                  <TableCell className="py-2.5 px-3">{a.userName}</TableCell>
                  <TableCell className="py-2.5 px-3 capitalize">{a.entity}</TableCell>
                  <TableCell className="py-2.5 px-3 font-semibold">{a.action}</TableCell>
                  <TableCell className="py-2.5 px-3 text-muted-foreground break-words min-w-48">{a.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
};
