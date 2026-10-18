import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useEscape } from '../../utils/useEscape';
import { IconX } from '@tabler/icons-react';

interface WorkflowGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenQuickAction: (action: 'customer' | 'job' | 'request' | 'quote' | 'invoice') => void;
}

export const WorkflowGuideModal: React.FC<WorkflowGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenQuickAction,
}) => {
  const { switchUserRole } = useApp(['switchUserRole']);
  const [activeWorkflow, setActiveWorkflow] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F'>('A');

  useEscape(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="wf-title">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 id="wf-title" className="text-lg font-bold text-slate-900">
              HVAC End-to-End Operational Workflows
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Walk through the complete UK HVAC business cycles, step by step
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close guide" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <IconX className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Workflow Tabs */}
        <div role="tablist" aria-label="Workflows" className="flex border-b border-slate-200 bg-slate-100/60 p-2 gap-1.5 overflow-x-auto">
          {[
            { id: 'A', title: 'Workflow A: Callout to Paid Invoice' },
            { id: 'B', title: 'Workflow B: Quote to Job to Invoice' },
            { id: 'C', title: 'Workflow C: Preventive Maintenance' },
            { id: 'D', title: 'Workflow D: On-Site Finding & Follow-up' },
            { id: 'E', title: 'Workflow E: Compliance & Safety' },
            { id: 'F', title: 'Workflow F: Credit Notes & Refunds' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveWorkflow(tab.id as 'A' | 'B' | 'C' | 'D' | 'E' | 'F')}
              role="tab"
              id={`wf-tab-${tab.id}`}
              aria-selected={activeWorkflow === tab.id}
              aria-controls="wf-panel"
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeWorkflow === tab.id
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div role="tabpanel" id="wf-panel" aria-labelledby={`wf-tab-${activeWorkflow}`} className="p-6 overflow-y-auto space-y-6 text-sm">
          {activeWorkflow === 'A' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900">
                <span className="font-bold">Workflow A Overview:</span> Customer enquiry → Service Request logged → Dispatcher books technician → Technician arrives, finishes checklist & captures customer signature → Service report printed or downloaded as PDF → Invoice generated → BACS Payment recorded. Works offline: changes made without signal are queued and replayed.
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Log Customer Request</p>
                    <p className="text-xs text-slate-600 mt-0.5">Check unassigned emergency request <strong>SR-1024</strong> (ByteForge server room AC whine) or log a new service enquiry.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('requests');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded border border-sky-200"
                  >
                    View Requests
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Dispatcher Schedules Job</p>
                    <p className="text-xs text-slate-600 mt-0.5">Convert request to job, assign an F-Gas certified technician (David Ross or Liam Campbell) with automatic conflict checking (30-minute travel buffer) and licence/expiry checks.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('dispatch');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded border border-sky-200"
                  >
                    Open Dispatch
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Technician Van Portal Execution</p>
                    <p className="text-xs text-slate-600 mt-0.5">Switch role to Technician. Mark "Arrived" → add checklist items from the job type's template → tick the checklist → log refrigerant handling and pressure readings → capture sign-off → generate and download the Service Report. No signal? Keep going: the app queues your changes.</p>
                  </div>
                  <button
                    onClick={() => {
                      switchUserRole('technician');
                      onClose();
                      onNavigateTab('technician_portal');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200"
                  >
                    Tech Van Portal
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">4</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Generate Invoice & Record Payment</p>
                    <p className="text-xs text-slate-600 mt-0.5">Generate VAT invoice from completed job labour and parts. Record BACS or card payment and balance reconciliation, then use Download PDF on the invoice sheet.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('invoices');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                  >
                    View Invoices
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeWorkflow === 'B' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
                <span className="font-bold">Workflow B Overview:</span> Customer requests installation estimate → Staff create itemised quotation (Labour, Equipment, VAT) → Customer accepts → 1-click Convert to Job → Work completed → Invoice generated without re-entry.
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Create or Inspect Quotation</p>
                    <p className="text-xs text-slate-600 mt-0.5">See quote <strong>QTE-2026-0041</strong> (£4,812.00 for Oliver Davies Daikin Multi-Split) or create a fresh estimate with UK VAT 20%.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('quotations');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                  >
                    View Quotes
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Record Acceptance & Convert to Job</p>
                    <p className="text-xs text-slate-600 mt-0.5">Click "Record Customer Acceptance" → click "Convert to Job" to automatically transfer lines and create installation job in dispatch calendar.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Convert to Invoice on Completion</p>
                    <p className="text-xs text-slate-600 mt-0.5">Produce the final invoice directly with matched pricing, VAT, and company bank sort code/account details.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeWorkflow === 'C' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                <span className="font-bold">Workflow C Overview:</span> A Maintenance Plan (quarterly, six-monthly or annual) is set up per site → the daily sweep raises a preventive-maintenance job 14 days before it is due, with the checklist template → Dispatcher assigns a technician → Tech completes the safety checklist → Equipment service history is updated.
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Inspect Maintenance Alerts</p>
                    <p className="text-xs text-slate-600 mt-0.5">Notice Mrs. Margaret Higgins’ Worcester Bosch boiler is overdue, or Dr. Finch’s Daikin Altherma is due this week.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('equipment');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                  >
                    View Equipment Register
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Set Up a Maintenance Plan</p>
                    <p className="text-xs text-slate-600 mt-0.5">Add an agreement for a customer site (optionally one appliance) with a frequency and first due date. The system then books each visit onto the dispatch board for you; no manual re-booking.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('maintenance');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                  >
                    Maintenance Plans
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Log Readings & Renew Warranty</p>
                    <p className="text-xs text-slate-600 mt-0.5">Technician logs Gas tightness, CO/CO2 ppm, or glycol concentration. Equipment asset history stores full audit log.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeWorkflow === 'D' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
                <span className="font-bold">Workflow D Overview:</span> Technician on site discovers additional work required → Records diagnostic findings and toggles "Recommend Follow-up Visit" → Office staff prepare additional quotation → Customer approves → Follow-up job scheduled.
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Technician Flags Additional Defect</p>
                    <p className="text-xs text-slate-600 mt-0.5">In Job JOB-2026-0810 (Crown & Thistle), technician flags that dining room AC unit requires a leak test or boiler expansion vessel replacement.</p>
                  </div>
                  <button
                    onClick={() => {
                      switchUserRole('technician');
                      onClose();
                      onNavigateTab('technician_portal');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200"
                  >
                    Open Tech Portal
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Office Prepares Follow-Up Quote</p>
                    <p className="text-xs text-slate-600 mt-0.5">Office reviews technician recommendation and creates a quick quotation for the required replacement part.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('quotations');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                  >
                    Quotations
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Customer Authorization & Follow-up Booked</p>
                    <p className="text-xs text-slate-600 mt-0.5">Authorization logged, follow-up repair booked into technician schedule.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeWorkflow === 'E' || activeWorkflow === 'F') && (() => {
            const w = activeWorkflow === 'E'
              ? {
                  banner: 'bg-rose-50 border-rose-200 text-rose-900',
                  overview: 'Technician is checked against the job (Gas Safe / F-Gas licence and expiry, travel buffer) → On site, safety checklist items are ticked and refrigerant handling is logged → The job cannot be completed without checklist, work performed and customer signature → Admin can override with a recorded reason.',
                  steps: [
                    { t: 'Assign a Qualified Technician', d: 'Open a job on a boiler or heat pump and try to assign a technician with no licence or an expired one: the board shows a Certification Requirement Gap and blocks the save. Set licence numbers and expiry dates under Settings → Technicians.', b: 'Open Dispatch', tab: 'dispatch', role: false },
                    { t: 'Log Refrigerant and Tick Safety Items', d: 'As the technician, add the Inspection or Repair checklist items, tick the gas safety and electrical ones, and record refrigerant type, kg, cylinder and certificate number.', b: 'Tech Van Portal', tab: 'technician_portal', role: true },
                    { t: 'Completion Gate', d: 'Try to complete with an unticked safety item or no signature: the job is refused and lists what is missing. Admins can force the status in the dispatch modal with a reason.', b: 'Open Dispatch', tab: 'dispatch', role: false },
                    { t: 'Manage Checklist Templates', d: 'Admins edit which items each job type offers, and reorder them by drag and drop.', b: 'Checklists', tab: 'checklists', role: false },
                  ],
                }
              : {
                  banner: 'bg-violet-50 border-violet-200 text-violet-900',
                  overview: 'An issued invoice contains an error or the customer returns work → Accountant raises a credit note for part or all of the invoice → Any payment already taken is refunded → The invoice moves to Credited and everything is audited. VAT return reflects the change.',
                  steps: [
                    { t: 'Find the Invoice', d: 'Open an issued or paid invoice. Void is only available while no payment or credit note exists, and needs a reason.', b: 'View Invoices', tab: 'invoices', role: false },
                    { t: 'Raise a Credit Note', d: 'Credit part or all of the invoice (VAT-inclusive amount plus a reason). The CN- number is allocated automatically and the balance is recalculated; a fully credited invoice shows the Credited status.', b: 'View Invoices', tab: 'invoices', role: false },
                    { t: 'Refund a Payment', d: 'Refund a recorded payment once; the invoice balance re-opens. Duplicate payment references are rejected.', b: 'View Invoices', tab: 'invoices', role: false },
                    { t: 'Check the VAT Return', d: 'Output VAT on invoices and input VAT on stock purchases for any period are available from the reports API (GET /reports/vat).', b: 'View Reports', tab: 'reports', role: false },
                  ],
                };
            return (
              <div className="space-y-4">
                <div className={`border rounded-lg p-3 text-xs ${w.banner}`}>
                  <span className="font-bold">Workflow {activeWorkflow} Overview:</span> {w.overview}
                </div>
                <div className="space-y-3">
                  {w.steps.map((step, i) => (
                    <div key={step.t} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{step.t}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{step.d}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (step.role) switchUserRole('technician');
                          onClose();
                          onNavigateTab(step.tab);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                      >
                        {step.b}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Workflow <strong>{activeWorkflow}</strong> test sequence
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
