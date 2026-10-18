import { useEffect, useState } from 'react';
import { UserRole } from './types';
import { IconAirConditioning, IconCalendarRepeat, IconCalendarTime, IconCertificate, IconChartBar, IconChecklist, IconDeviceMobile, IconFileText, IconHistory, IconInbox, IconLayoutDashboard, IconPackage, IconReceipt, IconSettings, IconUsers } from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';

/** Single source of truth for tabs and which roles may open them. */
export const navLinks: { id: string; label: string; icon: Icon; allowedRoles: UserRole[] }[] = [
  { id: 'dashboard', icon: IconLayoutDashboard, label: 'Dashboard', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'technician_portal', icon: IconDeviceMobile, label: 'Technician Portal', allowedRoles: ['admin', 'dispatcher', 'technician'] },
  { id: 'dispatch', icon: IconCalendarTime, label: 'Dispatch & Jobs', allowedRoles: ['admin', 'dispatcher'] },
  { id: 'customers', icon: IconUsers, label: 'Customers', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'equipment', icon: IconAirConditioning, label: 'Equipment & Assets', allowedRoles: ['admin', 'dispatcher', 'technician'] },
  { id: 'requests', icon: IconInbox, label: 'Service Requests', allowedRoles: ['admin', 'dispatcher'] },
  { id: 'maintenance', icon: IconCalendarRepeat, label: 'Maintenance Plans', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'quotations', icon: IconFileText, label: 'Quotations', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'invoices', icon: IconReceipt, label: 'Invoices & Payments', allowedRoles: ['admin', 'accountant'] },
  { id: 'inventory', icon: IconPackage, label: 'Parts & Stock', allowedRoles: ['admin', 'dispatcher', 'technician', 'accountant'] },
  { id: 'reports', icon: IconChartBar, label: 'Reports', allowedRoles: ['admin', 'accountant'] },
  { id: 'certificates', icon: IconCertificate, label: 'Gas Certificates', allowedRoles: ['admin', 'dispatcher', 'technician'] },
  { id: 'checklists', icon: IconChecklist, label: 'Checklists', allowedRoles: ['admin'] },
  { id: 'audit', icon: IconHistory, label: 'Audit Log', allowedRoles: ['admin'] },
  { id: 'settings', icon: IconSettings, label: 'Settings', allowedRoles: ['admin'] },
];

const readPath = () => window.location.pathname.replace(/^\/|\/$/g, '') || 'dashboard';

/**
 * Tab state kept in the URL path (survives refresh, back/forward work) and
 * guarded by role. Tabs not in navLinks (e.g. notifications) are open to all.
 */
export function useTabRoute(role: UserRole): [string, (tab: string) => void] {
  const [requested, setRequested] = useState<string>(readPath);
  const setTab = (tab: string) => {
    if (readPath() !== tab) window.history.pushState(null, '', `/${tab}`);
    setRequested(tab);
  };

  const link = navLinks.find((l) => l.id === requested);
  const home = role === 'technician' ? 'technician_portal' : 'dashboard';
  const known = link || requested === 'notifications';
  const tab = !known || (link && !link.allowedRoles.includes(role)) ? home : requested;

  useEffect(() => {
    if (tab !== requested) setTab(tab);
  }, [tab, requested]);

  useEffect(() => {
    const onPop = () => setRequested(readPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [tab, setTab];
}
