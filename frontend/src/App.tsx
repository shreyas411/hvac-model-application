/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthGate } from './components/auth/AuthGate';
import { Navbar } from './components/layout/Navbar';
import { useTabRoute } from './routes';
import { useDialogFocus } from './utils/useDialogFocus';
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
import { CertificatesView } from './components/certificates/CertificatesView';
import { AuditView } from './components/audit/AuditView';
import { SettingsView } from './components/settings/SettingsView';
import { WorkflowGuideModal } from './components/workflows/WorkflowGuideModal';
import { QuickCreateModals } from './components/modals/QuickCreateModals';
import { IconFlame } from '@tabler/icons-react';
import { Toast } from './components/common/Toast';

const AppContent: React.FC = () => {
  const { currentUser, toastMessage, showToast, settings, realAuth } = useApp(['currentUser', 'toastMessage', 'showToast', 'settings', 'realAuth']);
  const [currentTab, setCurrentTab] = useTabRoute(currentUser.role);
  const [workflowGuideOpen, setWorkflowGuideOpen] = useState<boolean>(false);
  const [quickActionModal, setQuickActionModal] = useState<
    'customer' | 'job' | 'request' | 'quote' | 'invoice' | null
  >(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  const toggleSidebar = () => setSidebarCollapsed((c) => { localStorage.setItem('sidebarCollapsed', c ? '0' : '1'); return !c; });
  useDialogFocus(); // focus trap + restore for all modal dialogs

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
        onQuickAction={setQuickActionModal}
        collapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      <div className={`${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'} flex-1 flex flex-col min-w-0 transition-[padding]`}>
      {/* Role & Permissions Banner — hidden for now */}
      {/* <RoleBanner onSelectTab={setCurrentTab} /> */}

      {/* Floating Toast Notification */}
      {toastMessage && <Toast {...toastMessage} onDismiss={() => showToast('')} />}

      {/* Main Content Viewport */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setCurrentTab}
            onOpenQuickAction={(action) => {
              setQuickActionModal(action);
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

        {currentTab === 'certificates' && <CertificatesView />}

        {currentTab === 'audit' && currentUser.role === 'admin' && <AuditView />}

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
        isOpen={workflowGuideOpen && !realAuth}
        onClose={() => setWorkflowGuideOpen(false)}
        onNavigateTab={setCurrentTab}
        onOpenQuickAction={(action) => setQuickActionModal(action)}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 no-print">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <IconFlame className="w-4 h-4 text-sky-700" />
            <span className="font-semibold text-slate-800">{settings.companyName}</span>
            <span aria-hidden="true">·</span>
            <span>UK Field Service Management</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Gas Safe: #{settings.gasSafeRegisterNo}</span>
          </div>

          {!realAuth && (
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
          )}
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
