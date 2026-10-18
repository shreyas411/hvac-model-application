import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { CustomerNotification } from '../../types';
import { formatDateUK } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconAlertCircle, IconBell, IconCircleCheck, IconClock, IconDeviceMobile, IconEye, IconMail, IconPlus, IconSend, IconX } from '@tabler/icons-react';

export const NotificationsView: React.FC = () => {
  const { notifications, customers, sendNotification, createNotification, currentUser, customerById } = useApp(['notifications', 'customers', 'sendNotification', 'createNotification', 'currentUser', 'customerById']);

  const [previewNotif, setPreviewNotif] = useState<CustomerNotification | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [busy, setBusy] = useState(false); // guards double-sends/double-creates

  // New notification template builder
  const [targetCustomerId, setTargetCustomerId] = useState(customers[0]?.id || '');
  const [notifType, setNotifType] = useState<CustomerNotification['type']>('booking_confirmation');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customerById.get(targetCustomerId);
    if (!cust) return;

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

  useEscape(!!previewNotif || showNewModal, () => { setPreviewNotif(null); setShowNewModal(false); });

  const handleSendNow = async (id: string) => {
    setBusy(true);
    const sent = await sendNotification(id);
    setBusy(false);
    if (sent && previewNotif?.id === id) setPreviewNotif(sent);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Customer Notifications & Automated Templates
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Booking confirmations, van arrival alerts, quotation proposals, and invoice dispatches
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Draft Notification</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>Customer Communications Queue ({notifications.length})</span>
          <span className="text-slate-500 font-normal">
            Respects UK GDPR communication preferences
          </span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {notifications.length === 0 && <div className="py-6"><EmptyState icon={IconBell}>No notifications yet.</EmptyState></div>}
          {notifications.map((notif) => {
            const cust = customerById.get(notif.customerId);
            const isSent = notif.status === 'sent';

            return (
              <div
                key={notif.id}
                className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{cust?.name}</span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      {notif.channel === 'email' ? <IconMail className="w-3 h-3" aria-hidden="true" /> : <IconDeviceMobile className="w-3 h-3" aria-hidden="true" />}
                      <span>{notif.recipient}</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {notif.type.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="font-medium text-slate-800">{notif.subject}</p>
                  <p className="text-slate-600 text-[11px] line-clamp-1">{notif.messageBody}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    isSent ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {isSent ? `Sent on ${formatDateUK(notif.sentAt || '')}` : 'Ready for Approval'}
                  </span>

                  <button
                    onClick={() => setPreviewNotif(notif)}
                    aria-label={`Preview: ${notif.subject}`} className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Preview
                  </button>

                  {!isSent && (
                    <button
                      onClick={() => handleSendNow(notif.id)}
                      disabled={busy}
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold text-xs flex items-center gap-1 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      <IconSend className="w-3 h-3" aria-hidden="true" />
                      <span>Approve & IconSend</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      {previewNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Message preview">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Message Preview</h3>
                <p className="text-slate-500 mt-0.5">
                  Channel: <strong className="uppercase">{previewNotif.channel}</strong> · To: {previewNotif.recipient}
                </p>
              </div>
              <button
                onClick={() => setPreviewNotif(null)}
                aria-label="Close preview" className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 font-semibold text-slate-800">
                Subject: {previewNotif.subject}
              </div>
              <div className="bg-slate-50 p-3.5 rounded border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
                {previewNotif.messageBody}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Status: {previewNotif.status}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewNotif(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Close
                </button>
                {previewNotif.status !== 'sent' && (
                  <button
                    onClick={() => handleSendNow(previewNotif.id)}
                    disabled={busy}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60"
                  >
                    IconSend to Customer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Notification Draft Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Prepare customer notification">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Prepare Customer Notification</h3>
              <button
                onClick={() => setShowNewModal(false)}
                aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="p-5 space-y-3 overflow-y-auto text-xs">
              <div>
                <label htmlFor="n-customer" className="block font-semibold text-slate-700 mb-1">Customer Recipient *</label>
                <select
                  id="n-customer" value={targetCustomerId}
                  onChange={(e) => setTargetCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email || c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="n-type" className="block font-semibold text-slate-700 mb-1">Notification Type</label>
                  <select
                    id="n-type" value={notifType}
                    onChange={(e) => setNotifType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                  >
                    <option value="booking_confirmation">Booking Confirmation</option>
                    <option value="appointment_reminder">Appointment Reminder</option>
                    <option value="technician_arriving">Technician En Route</option>
                    <option value="quotation_ready">Quotation Proposal</option>
                    <option value="invoice_issued">Invoice Issued</option>
                  <option value="payment_reminder">Payment Reminder</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="n-channel" className="block font-semibold text-slate-700 mb-1">Channel</label>
                  <select
                    id="n-channel" value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS Text</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="n-subject" className="block font-semibold text-slate-700 mb-1">Subject Header</label>
                <input
                  type="text"
                  required
                  id="n-subject" name="subject" autoComplete="off" placeholder="e.g. Appointment confirmation…" value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div>
                <label htmlFor="n-body" className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={4}
                  required
                  id="n-body" name="message" placeholder="Write the message…" value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
