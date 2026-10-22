import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { Button } from '@/src/components/ui/button';
import { IconArrowRight, IconBriefcase, IconDeviceMobile, IconFileSpreadsheet, IconUsers } from '@tabler/icons-react';

interface RoleBannerProps {
  onSelectTab: (tab: string) => void;
}

export const RoleBanner: React.FC<RoleBannerProps> = ({ onSelectTab }) => {
  const { currentUser, switchUserRole, realAuth } = useApp(['currentUser', 'switchUserRole', 'realAuth']);

  const roleConfigs: Record<
    UserRole,
    { title: string; badge: string; desc: string; icon: React.ReactNode; primaryAction?: { label: string; tab: string } }
  > = {
    admin: {
      title: 'Business Owner / Admin Mode',
      badge: 'Full Access',
      desc: 'You can configure company settings, manage staff, view all financial reports, and oversee field operations.',
      icon: <IconBriefcase className="w-4 h-4 text-emerald-600" aria-hidden="true" />,
      primaryAction: { label: 'View Dashboard', tab: 'dashboard' },
    },
    dispatcher: {
      title: 'Office Manager & Dispatcher Mode',
      badge: 'Scheduling & Ops',
      desc: 'You can triage customer service requests, manage technician schedules, check booking conflicts, and assign jobs.',
      icon: <IconUsers className="w-4 h-4 text-sky-600" aria-hidden="true" />,
      primaryAction: { label: 'Go to Dispatch Board', tab: 'dispatch' },
    },
    technician: {
      title: 'Field Technician Mode',
      badge: 'Van & Field App',
      desc: 'Mobile-first job flow: on the way, site access, Gas & F-Gas checklists, parts used, customer sign-off, and service reports. Financial and company settings are restricted.',
      icon: <IconDeviceMobile className="w-4 h-4 text-indigo-600" aria-hidden="true" />,
      primaryAction: { label: 'Open Technician Van View', tab: 'technician_portal' },
    },
    accountant: {
      title: 'Accountant Mode',
      badge: 'Financial Ledger',
      desc: 'Manage customer invoices, track partial payments, reconcile BACS receipts, inspect UK VAT (20%/5%/0%), and review revenue reports.',
      icon: <IconFileSpreadsheet className="w-4 h-4 text-amber-600" aria-hidden="true" />,
      primaryAction: { label: 'Open Invoices & Ledger', tab: 'invoices' },
    },
  };

  const currentConfig = roleConfigs[currentUser.role];

  return (
    <div className="bg-muted border-b border-border py-2 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        {/* Current Role Info */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-background rounded border border-border">
            {currentConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{currentConfig.title}</span>
              <span className="text-[11px] font-medium text-muted-foreground">({currentConfig.badge})</span>
            </div>
            <p className="text-muted-foreground line-clamp-1">{currentConfig.desc}</p>
          </div>
        </div>

        {/* Quick Switch Buttons for Testing Roles (dev only: signed-in users can't switch) */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {!realAuth && (<>
          <span className="text-[11px] text-muted-foreground font-medium mr-1 hidden sm:inline">
            Test as:
          </span>
          {(['admin', 'dispatcher', 'technician', 'accountant'] as const).map((role) => (
            <Button
              key={role}
              size="xs"
              variant={currentUser.role === role ? 'default' : 'outline'}
              onClick={() => {
                switchUserRole(role);
                if (role === 'technician') onSelectTab('technician_portal');
              }}
              aria-pressed={currentUser.role === role}
              className="capitalize text-[11px]"
            >
              {role}
            </Button>
          ))}
          </>)}

          {currentConfig.primaryAction && (
            <Button variant="link" size="xs" className="ml-2 text-[11px] font-semibold" onClick={() => onSelectTab(currentConfig.primaryAction!.tab)}>
              <span>{currentConfig.primaryAction.label}</span>
              <IconArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
