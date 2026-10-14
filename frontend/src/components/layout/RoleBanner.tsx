import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { ShieldCheck, ArrowRight, Smartphone, Briefcase, FileSpreadsheet, Users } from 'lucide-react';

interface RoleBannerProps {
  onSelectTab: (tab: string) => void;
}

export const RoleBanner: React.FC<RoleBannerProps> = ({ onSelectTab }) => {
  const { currentUser, switchUserRole, realAuth } = useApp();

  const roleConfigs: Record<
    UserRole,
    { title: string; badge: string; desc: string; icon: React.ReactNode; primaryAction?: { label: string; tab: string } }
  > = {
    admin: {
      title: 'Business Owner / Admin Mode',
      badge: 'Full Access',
      desc: 'You can configure company settings, manage staff, view all financial reports, and oversee field operations.',
      icon: <Briefcase className="w-4 h-4 text-emerald-600" />,
      primaryAction: { label: 'View Dashboard', tab: 'dashboard' },
    },
    dispatcher: {
      title: 'Office Manager & Dispatcher Mode',
      badge: 'Scheduling & Ops',
      desc: 'You can triage customer service requests, manage technician schedules, check booking conflicts, and assign jobs.',
      icon: <Users className="w-4 h-4 text-sky-600" />,
      primaryAction: { label: 'Go to Dispatch Board', tab: 'dispatch' },
    },
    technician: {
      title: 'Field Technician Mode (Liam Campbell)',
      badge: 'Van & Field App',
      desc: 'Mobile-first job flow: on the way, site access, Gas & F-Gas checklists, parts used, customer sign-off, and service reports. Financial and company settings are restricted.',
      icon: <Smartphone className="w-4 h-4 text-indigo-600" />,
      primaryAction: { label: 'Open Technician Van View', tab: 'technician_portal' },
    },
    accountant: {
      title: 'Accountant Mode',
      badge: 'Financial Ledger',
      desc: 'Manage customer invoices, track partial payments, reconcile BACS receipts, inspect UK VAT (20%/5%/0%), and review revenue reports.',
      icon: <FileSpreadsheet className="w-4 h-4 text-amber-600" />,
      primaryAction: { label: 'Open Invoices & Ledger', tab: 'invoices' },
    },
  };

  const currentConfig = roleConfigs[currentUser.role];

  return (
    <div className="bg-slate-100 border-b border-slate-200 py-2 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        {/* Current Role Info */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white rounded border border-slate-200">
            {currentConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{currentConfig.title}</span>
              <span className="text-[11px] font-medium text-slate-500">({currentConfig.badge})</span>
            </div>
            <p className="text-slate-600 line-clamp-1">{currentConfig.desc}</p>
          </div>
        </div>

        {/* Quick Switch Buttons for Testing Roles (dev only: signed-in users can't switch) */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {!realAuth && (<>
          <span className="text-[11px] text-slate-500 font-medium mr-1 hidden sm:inline">
            Test as:
          </span>
          <button
            onClick={() => switchUserRole('admin')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentUser.role === 'admin'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => switchUserRole('dispatcher')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentUser.role === 'dispatcher'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Dispatcher
          </button>
          <button
            onClick={() => {
              switchUserRole('technician');
              onSelectTab('technician_portal');
            }}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentUser.role === 'technician'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Technician
          </button>
          <button
            onClick={() => switchUserRole('accountant')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentUser.role === 'accountant'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Accountant
          </button>
          </>)}

          {currentConfig.primaryAction && (
            <button
              onClick={() => onSelectTab(currentConfig.primaryAction!.tab)}
              className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 transition-colors"
            >
              <span>{currentConfig.primaryAction.label}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
