import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { IconArchive, IconArchiveOff, IconCircleCheck, IconDownload, IconEye, IconPencil, IconPlus, IconSearch, IconTrash, IconUsers, IconX } from '@tabler/icons-react';
import { SortHead, useServerPaged } from '../common/Pager';
import { downloadCsv } from '../../utils/csv';
import { getTodayISO } from '../../utils/formatters';
import { BulkBar, SelectAllHead, SelectCell, useRowSelection } from '../common/BulkSelect';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { CustomerFormDrawer } from './CustomerFormDrawer';
import { Customer360Drawer } from './Customer360Drawer';
import { Tip } from '@/src/components/common/Tip';

interface CustomersViewProps {
  onOpenQuickAction: (action: 'customer' | 'job' | 'quote' | 'invoice' | 'request', customerId?: string) => void;
  onNavigateTab: (tab: string) => void;
}

type TypeFilter = 'all' | 'residential' | 'commercial' | 'landlord';

export const CustomersView: React.FC<CustomersViewProps> = ({ onOpenQuickAction }) => {
  const { customers, archiveCustomer, bulkArchiveCustomers, deleteRecord, currentUser, confirmToast, showToast } =
    useApp(['customers', 'archiveCustomer', 'bulkArchiveCustomers', 'deleteRecord', 'currentUser', 'confirmToast', 'showToast']);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState<{ customer: Customer | null } | null>(null); // null = closed, customer null = add

  // Search, type and archived filters run on the server so paging covers the whole list
  const paged = useServerPaged<Customer>('/customers', { q: searchTerm.trim() || undefined, type: typeFilter === 'all' ? undefined : typeFilter, archived: String(showArchived) }, customers);
  const filtered = !!searchTerm || typeFilter !== 'all' || showArchived;
  const clearFilters = () => { setSearchTerm(''); setTypeFilter('all'); setShowArchived(false); };

  const sel = useRowSelection(paged.rows);
  const bulkArchive = async () => {
    const rows = sel.selected;
    const failed = await bulkArchiveCustomers(rows.map((c) => c.id), !showArchived);
    sel.clear();
    const bad = rows.filter((c) => failed[c.id]);
    if (bad.length) showToast(`${rows.length - bad.length} of ${rows.length} done. Skipped: ${bad.map((c) => `${c.name}: ${failed[c.id]}`).join('; ')}`, 'error');
  };
  const exportSelected = () => downloadCsv(`customers-${getTodayISO()}.csv`, [
    ['Name', 'Company', 'Type', 'Email', 'Phone', 'Address', 'City', 'Postcode', 'Sites', 'GDPR consent'],
    ...sel.selected.map((c) => [c.name, c.companyName, c.type, c.email, c.phone, c.serviceLocations[0]?.addressLine1, c.serviceLocations[0]?.city, c.serviceLocations[0]?.postcode, c.serviceLocations.length, c.gdprConsent ? 'Yes' : 'No']),
  ]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      {/* Header: title left, primary action right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">Customers</h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'customer' : 'customers'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Accounts, sites and the full history for each customer in one place</p>
        </div>
        <Button size="sm" onClick={() => setForm({ customer: null })} className="shrink-0">
          <IconPlus aria-hidden="true" />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* Toolbar: search → filters → right-aligned extras */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search customers" name="search" autoComplete="off"
            placeholder="Search name, email, postcode…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger size="sm" aria-label="Customer type" className="w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="landlord">Landlord</SelectItem>
          </SelectContent>
        </Select>
        <Select value={showArchived ? 'archived' : 'active'} onValueChange={(v) => setShowArchived(v === 'archived')}>
          <SelectTrigger size="sm" aria-label="Customer status" className="w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" size="xs" onClick={clearFilters}><IconX aria-hidden="true" />Clear filters</Button>
        )}
      </div>

      <BulkBar count={sel.selected.length} onClear={sel.clear}>
        <Button type="button" size="xs" onClick={() => confirmToast(`${showArchived ? 'Restore' : 'Archive'} ${sel.selected.length} customer${sel.selected.length === 1 ? '' : 's'}?`, () => void bulkArchive())}>{showArchived ? <IconArchiveOff aria-hidden="true" /> : <IconArchive aria-hidden="true" />}{showArchived ? 'Restore' : 'Archive'}</Button>
        <Button type="button" size="xs" variant="secondary" onClick={exportSelected}><IconDownload aria-hidden="true" />Export CSV</Button>
      </BulkBar>

      <TableCard footer={paged.pager}>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <SelectAllHead sel={sel} label="customers" />
              <SortHead paged={paged} by="name" className="px-3">Customer / Company</SortHead>
              <SortHead paged={paged} by="type" className="hidden md:table-cell px-3">Type</SortHead>
              <SortHead paged={paged} by="email" className="px-3">Contact</SortHead>
              <TableHead className="hidden md:table-cell px-3">Primary Service Location</TableHead>
              <TableHead className="hidden md:table-cell px-3">Sites</TableHead>
              <TableHead className="hidden md:table-cell px-3">GDPR</TableHead>
              <TableHead className="px-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((c) => {
              const primaryLoc = c.serviceLocations[0];
              return (
                <TableRow key={c.id} data-state={sel.has(c.id) ? 'selected' : undefined}>
                  <SelectCell sel={sel} row={c} label={c.name} />
                  <TableCell className="px-3 py-3">
                    <button onClick={() => setSelectedCustomerId(c.id)} className="text-left group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="font-bold group-hover:text-primary block">{c.name}</span>
                      {c.companyName && <span className="text-[11px] text-muted-foreground block">{c.companyName}</span>}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3">
                    <Badge variant="outline" className={`capitalize ${c.type === 'commercial' ? 'bg-sky-50 text-sky-800 border-sky-200' : c.type === 'landlord' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-muted text-foreground'}`}>{c.type}</Badge>
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <span className="block font-medium">{c.phone}</span>
                    <Tip label={c.email}><span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">{c.email}</span></Tip>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3 max-w-[200px]">
                    <Tip label={primaryLoc?.addressLine1}><span className="block truncate">{primaryLoc?.addressLine1}</span></Tip>
                    <span className="text-[11px] text-muted-foreground tabular-nums block">{primaryLoc?.city}, {primaryLoc?.postcode}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3">
                    <Badge variant="secondary" className="tabular-nums">{c.serviceLocations.length} {c.serviceLocations.length === 1 ? 'site' : 'sites'}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3">
                    {c.gdprConsent ? (
                      <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1"><IconCircleCheck className="w-3 h-3" aria-hidden="true" /><span>Consent OK</span></span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <RowActions subject={c.name} actions={[
                      { icon: IconEye, label: 'View', onClick: () => setSelectedCustomerId(c.id) },
                      { icon: IconPencil, label: 'Edit', onClick: () => setForm({ customer: c }) },
                      { icon: IconTrash, label: 'Delete', destructive: true, hidden: currentUser?.role !== 'admin',
                        onClick: () => confirmToast(`Delete ${c.name}? Customers with jobs, quotes, invoices, requests or equipment can't be deleted; archive them instead.`, () => void deleteRecord('customers', c.id, 'Customer')) },
                      { icon: c.archived ? IconArchiveOff : IconArchive, label: c.archived ? 'Restore' : 'Archive', onClick: () => void archiveCustomer(c.id) },
                    ]} />
                  </TableCell>
                </TableRow>
              );
            })}
            {paged.rows.length === 0 && !paged.loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-6"><EmptyState icon={IconUsers}>No customers found matching your criteria.</EmptyState></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableCard>

      {selectedCustomerId && (
        <Customer360Drawer customerId={selectedCustomerId} onNew={(action) => onOpenQuickAction(action, selectedCustomerId)} onClose={() => setSelectedCustomerId(null)} onEdit={(id) => setForm({ customer: customers.find((x) => x.id === id) ?? null })} />
      )}
      {form && <CustomerFormDrawer customer={form.customer} onClose={() => setForm(null)} onSaved={setSelectedCustomerId} />}
    </div>
  );
};
