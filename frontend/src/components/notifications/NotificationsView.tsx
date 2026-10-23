import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { CustomerNotification } from '../../types';
import { formatDateUK } from '../../utils/formatters';
import { IconBell, IconDeviceMobile, IconEye, IconMail, IconPlus, IconSearch, IconSend, IconX } from '@tabler/icons-react';
import { BulkBar, SelectAllHead, SelectCell, useRowSelection } from '../common/BulkSelect';
import { Combobox } from '../common/Combobox';
import { DetailDrawer } from '../common/DetailDrawer';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Textarea } from '@/src/components/ui/textarea';
import { Tip } from '@/src/components/common/Tip';

export const NotificationsView: React.FC = () => {
  const { notifications, customers, sendNotification, bulkSendNotifications, createNotification, currentUser, customerById, confirmToast, showToast } = useApp(['notifications', 'customers', 'sendNotification', 'bulkSendNotifications', 'createNotification', 'currentUser', 'customerById', 'confirmToast', 'showToast']);

  const [previewNotif, setPreviewNotif] = useState<CustomerNotification | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [busy, setBusy] = useState(false); // guards double-sends/double-creates
  const [show, setShow] = useState<'all' | 'pending' | 'sent'>('pending');

  // New notification template builder
  const [targetCustomerId, setTargetCustomerId] = useState('');
  const [notifType, setNotifType] = useState<CustomerNotification['type']>('booking_confirmation');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customerById.get(targetCustomerId);
    if (!cust) return showToast('Pick the customer first.', 'error');

    setBusy(true);
    const created = await createNotification({
      customerId: cust.id,
      type: notifType,
      recipient: channel === 'email' ? cust.email : cust.phone,
      channel,
      subject,
      messageBody,
      status: 'ready_to_send',
    });
    setBusy(false);
    if (!created) return;

    setSubject('');
    setMessageBody('');
    setShowNewModal(false);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const handleSendNow = async (id: string) => {
    setBusy(true);
    const sent = await sendNotification(id);
    setBusy(false);
    if (sent && previewNotif?.id === id) setPreviewNotif(sent);
  };

  const pending = notifications.filter((n) => n.status !== 'sent');
  const byStatus = show === 'all' ? notifications : show === 'sent' ? notifications.filter((n) => n.status === 'sent') : pending;
  const visible = searchTerm.trim() ? byStatus.filter((n) => `${customerById.get(n.customerId)?.name ?? ''} ${n.subject} ${n.recipient}`.toLowerCase().includes(searchTerm.trim().toLowerCase())) : byStatus;
  const approveAll = async () => {
    setBusy(true);
    for (const n of pending) await sendNotification(n.id); // sequential: one failure shows its own toast, the rest continue
    setBusy(false);
  };

  const sel = useRowSelection(visible, (n) => n.status !== 'sent' && n.status !== 'sending');
  const bulkSend = async () => {
    const rows = sel.selected;
    setBusy(true);
    const failed = await bulkSendNotifications(rows.map((n) => n.id));
    setBusy(false);
    sel.clear();
    const bad = rows.filter((n) => failed[n.id]);
    if (bad.length) showToast(`${rows.length - bad.length} of ${rows.length} sent. Skipped: ${bad.map((n) => `${customerById.get(n.customerId)?.name ?? n.recipient}: ${failed[n.id]}`).join('; ')}`, 'error');
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">Customer Notifications</h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${visible.length} ${visible.length === 1 ? 'notification' : 'notifications'}`}>{visible.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Booking confirmations, van arrival alerts, quotation proposals and invoice dispatches. Respects UK GDPR communication preferences.</p>
        </div>
        <Button size="sm" onClick={() => setShowNewModal(true)} className="shrink-0"><IconPlus aria-hidden="true" />Draft Notification</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search notifications" autoComplete="off" placeholder="Search customer, subject, recipient…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={show} onValueChange={(v) => setShow(v as typeof show)}>
          <SelectTrigger size="sm" aria-label="Notification status" className="w-48 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{`Needs approval (${pending.length})`}</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || show !== 'pending') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setShow('pending'); }}><IconX aria-hidden="true" />Clear filters</Button>}
        {pending.length > 1 && show !== 'sent' && <Button type="button" size="xs" disabled={busy} onClick={() => confirmToast(`Approve and send ${pending.length} notifications?`, () => void approveAll(), { confirmLabel: 'Approve all' })}><IconSend aria-hidden="true" />Approve all ({pending.length})</Button>}
      </div>

      <BulkBar count={sel.selected.length} onClear={sel.clear}>
        <Button type="button" size="xs" disabled={busy} onClick={() => confirmToast(`Approve and send ${sel.selected.length} notification${sel.selected.length === 1 ? '' : 's'}?`, () => void bulkSend(), { confirmLabel: 'Approve & send' })}><IconSend aria-hidden="true" />Approve & send {sel.selected.length}</Button>
      </BulkBar>

      <div style={{ '--table-offset': '16.5rem' } as React.CSSProperties}>
        <TableCard>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <SelectAllHead sel={sel} label="notifications" />
                <TableHead className="px-3">Customer</TableHead>
                <TableHead className="hidden md:table-cell px-3">Type</TableHead>
                <TableHead className="px-3">Subject</TableHead>
                <TableHead className="hidden md:table-cell px-3">Channel</TableHead>
                <TableHead className="px-3">Status</TableHead>
                <TableHead className="px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((notif) => {
                const cust = customerById.get(notif.customerId);
                const isSent = notif.status === 'sent';
                return (
                  <TableRow key={notif.id} data-state={sel.has(notif.id) ? 'selected' : undefined}>
                    <SelectCell sel={sel} row={notif} label={notif.subject} />
                    <TableCell className="px-3 py-3 font-bold">{cust?.name}</TableCell>
                    <TableCell className="hidden md:table-cell px-3 py-3 capitalize">{notif.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="px-3 py-3 max-w-[360px]">
                      <Tip label={notif.subject}><span className="block font-medium truncate">{notif.subject}</span></Tip>
                      <span className="block text-[11px] text-muted-foreground truncate">{notif.messageBody}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-3 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1">{notif.channel === 'email' ? <IconMail className="w-3 h-3" aria-hidden="true" /> : <IconDeviceMobile className="w-3 h-3" aria-hidden="true" />}{notif.recipient}</span>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <Badge variant="outline" className={isSent ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}>{isSent ? `Sent ${formatDateUK(notif.sentAt || '')}` : 'Ready for approval'}</Badge>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <RowActions subject={notif.subject} actions={[
                        { icon: IconEye, label: 'Preview', onClick: () => setPreviewNotif(notif) },
                        { icon: IconSend, label: 'Approve & send', hidden: isSent || busy, onClick: () => void handleSendNow(notif.id) },
                      ]} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && <TableRow><TableCell colSpan={7} className="py-6"><EmptyState icon={IconBell}>No notifications match.</EmptyState></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      {previewNotif && (
        <DetailDrawer onClose={() => setPreviewNotif(null)} title="Message Preview" description={<>Channel: <strong className="uppercase">{previewNotif.channel}</strong> · To: {previewNotif.recipient}</>}
          footer={<>
            <span className="mr-auto text-[11px] text-muted-foreground tabular-nums">Status: {previewNotif.status}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewNotif(null)}>Close</Button>
            {previewNotif.status !== 'sent' && <Button size="sm" disabled={busy} onClick={() => void handleSendNow(previewNotif.id)}>Send to Customer</Button>}
          </>}>
          <div className="space-y-2 text-xs">
            <div className="bg-muted p-2.5 rounded border border-border font-semibold text-foreground">Subject: {previewNotif.subject}</div>
            <div className="bg-muted p-3.5 rounded border border-border text-foreground whitespace-pre-wrap leading-relaxed">{previewNotif.messageBody}</div>
          </div>
        </DetailDrawer>
      )}

      {showNewModal && (
        <DetailDrawer onClose={() => setShowNewModal(false)} dirty={!busy && !!(targetCustomerId || subject || messageBody)} title="Prepare Customer Notification" description="Saved to the approval queue"
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button type="submit" form="notif-form" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save to Queue'}</Button>
          </>}>
          <form id="notif-form" onSubmit={handleCreateDraft} className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="n-customer" className="font-semibold">Customer Recipient *</Label>
              <Combobox id="n-customer" value={targetCustomerId} onChange={setTargetCustomerId} placeholder="Select a customer…" searchPlaceholder="Search customers…" options={customers.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name, hint: c.email || c.phone }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="n-type" className="font-semibold">Notification Type</Label>
                <Select value={notifType} onValueChange={(v) => setNotifType(v as typeof notifType)}>
                  <SelectTrigger id="n-type" className="w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking_confirmation">Booking Confirmation</SelectItem>
                    <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                    <SelectItem value="technician_arriving">Technician En Route</SelectItem>
                    <SelectItem value="quotation_ready">Quotation Proposal</SelectItem>
                    <SelectItem value="invoice_issued">Invoice Issued</SelectItem>
                    <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-channel" className="font-semibold">Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                  <SelectTrigger id="n-channel" className="w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-subject" className="font-semibold">Subject Header *</Label>
              <Input type="text" required id="n-subject" name="subject" autoComplete="off" placeholder="e.g. Appointment confirmation…" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-body" className="font-semibold">Message Body *</Label>
              <Textarea rows={6} required id="n-body" name="message" placeholder="Write the message…" value={messageBody} onChange={(e) => setMessageBody(e.target.value)} />
            </div>
          </form>
        </DetailDrawer>
      )}
    </div>
  );
};
