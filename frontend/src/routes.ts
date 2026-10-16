import { useEffect, useState } from 'react';
import { UserRole } from './types';

/** Single source of truth for tabs and which roles may open them. */
export const navLinks: { id: string; label: string; allowedRoles: UserRole[] }[] = [
  { id: 'dashboard', label: 'Dashboard', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'technician_portal', label: 'Technician Portal', allowedRoles: ['admin', 'dispatcher', 'technician'] },
  { id: 'dispatch', label: 'Dispatch & Jobs', allowedRoles: ['admin', 'dispatcher'] },
  { id: 'customers', label: 'Customers', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'equipment', label: 'Equipment & Assets', allowedRoles: ['admin', 'dispatcher', 'technician'] },
  { id: 'requests', label: 'Service Requests', allowedRoles: ['admin', 'dispatcher'] },
  { id: 'maintenance', label: 'Maintenance Plans', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'quotations', label: 'Quotations', allowedRoles: ['admin', 'dispatcher', 'accountant'] },
  { id: 'invoices', label: 'Invoices & Payments', allowedRoles: ['admin', 'accountant'] },
  { id: 'inventory', label: 'Parts & Stock', allowedRoles: ['admin', 'dispatcher', 'technician', 'accountant'] },
  { id: 'reports', label: 'Reports', allowedRoles: ['admin', 'accountant'] },
  { id: 'checklists', label: 'Checklists', allowedRoles: ['admin'] },
  { id: 'settings', label: 'Settings', allowedRoles: ['admin'] },
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
