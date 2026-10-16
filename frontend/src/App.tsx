/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthGate } from './components/auth/AuthGate';
import { Navbar } from './components/layout/Navbar';
import { useTabRoute } from './routes';
import { RoleBanner } from './components/layout/RoleBanner';
import { DashboardView } from './components/dashboard/DashboardView';
import { DispatchBoardView } from './components/scheduling/DispatchBoardView';
import { TechnicianPortalView } from './components/technician/TechnicianPortalView';
import { CustomersView } from './components/customers/CustomersView';
import { EquipmentView } from './components/equipment/EquipmentView';
import { ServiceRequestsView } from './components/requests/ServiceRequestsView';
import { QuotationsView } from './components/quotations/QuotationsView';
import { InvoicesView } from './components/invoices/InvoicesView';
import { InventoryView } from './components/inventory/InventoryView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { ReportsView } from './components/reports/ReportsView';
import { MaintenanceView } from './components/maintenance/MaintenanceView';
import { ChecklistsView } from './components/checklists/ChecklistsView';
import { SettingsView } from './components/settings/SettingsView';
import { WorkflowGuideModal } from './components/workflows/WorkflowGuideModal';
import { QuickCreateModals } from './components/modals/QuickCreateModals';
import { CheckCircle2, AlertCircle, Info, Flame } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, toastMessage, settings } = useApp();
  const [currentTab, setCurrentTab] = useTabRoute(currentUser.role);
  const [workflowGuideOpen, setWorkflowGuideOpen] = useState<boolean>(false);
  const [quickActionModal, setQuickActionModal] = useState<
    'customer' | 'job' | 'request' | 'quote' | 'invoice' | null
  >(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // If user is technician, default to technician portal
  React.useEffect(() => {
    if (currentUser.role === 'technician' && currentTab === 'dashboard') {
      setCurrentTab('technician_portal');
    }
  }, [currentUser.role]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenWorkflowGuide={() => setWorkflowGuideOpen(true)}
        onQuickAction={(action) => {
          if (action === 'customer') {
            setCurrentTab('customers');
          } else {
            setQuickActionModal(action);
          }
        }}
      />

      <div className="lg:pl-60 flex-1 flex flex-col min-w-0">
      {/* Role & Permissions Banner */}
      <RoleBanner onSelectTab={setCurrentTab} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2.5 text-xs font-semibold ${
              toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-800'
                : toastMessage.type === 'info'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-emerald-800 text-white border-emerald-700'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <Info className="w-4 h-4 text-sky-300 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setCurrentTab}
            onOpenQuickAction={(action) => {
              if (action === 'customer') {
                setCurrentTab('customers');
              } else {
                setQuickActionModal(action);
              }
            }}
            onOpenWorkflowGuide={() => setWorkflowGuideOpen(true)}
            onSelectJob={(id) => setSelectedJobId(id)}
          />
        )}

        {currentTab === 'technician_portal' && (
          <TechnicianPortalView onNavigateTab={setCurrentTab} />
        )}

        {currentTab === 'dispatch' && (
          <DispatchBoardView
            onOpenQuickAction={(action) => setQuickActionModal(action)}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
        )}

        {currentTab === 'customers' && (
          <CustomersView
            onOpenQuickAction={(action) => setQuickActionModal(action as any)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'equipment' && (
          <EquipmentView
            onOpenQuickAction={(action) => setQuickActionModal(action)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'requests' && (
          <ServiceRequestsView
            onOpenQuickAction={(action) => setQuickActionModal(action)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'quotations' && (
          <QuotationsView
            onOpenQuickAction={(action) => setQuickActionModal(action)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'invoices' && (
          <InvoicesView
            onOpenQuickAction={(action) => setQuickActionModal(action)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'inventory' && <InventoryView />}

        {currentTab === 'notifications' && <NotificationsView />}

        {currentTab === 'reports' && <ReportsView />}

        {currentTab === 'maintenance' && currentUser.role !== 'technician' && <MaintenanceView />}
        {currentTab === 'checklists' && currentUser.role === 'admin' && <ChecklistsView />}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      {/* Quick Action Modal */}
      <QuickCreateModals
        activeModal={quickActionModal}
        onClose={() => setQuickActionModal(null)}
        onNavigateTab={setCurrentTab}
      />

      {/* Interactive Workflow Guide Modal (Workflows A, B, C, D) */}
      <WorkflowGuideModal
        isOpen={workflowGuideOpen}
        onClose={() => setWorkflowGuideOpen(false)}
        onNavigateTab={setCurrentTab}
        onOpenQuickAction={(action) => setQuickActionModal(action)}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-sky-700" />
            <span className="font-semibold text-slate-800">{settings.companyName}</span>
            <span aria-hidden="true">·</span>
            <span>UK Field Service Management</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Gas Safe: #{settings.gasSafeRegisterNo}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>Realistic Sample Business Data Loaded</span>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setWorkflowGuideOpen(true)}
              className="hover:text-sky-700 underline font-medium"
            >
              Test End-to-End Workflows
            </button>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthGate>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthGate>
  );
}
