import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { navLinks } from '../../routes';
import { useDataStore } from '../../store/useDataStore';
import { IconBell, IconFlame, IconHelp, IconLogout, IconMenu2, IconPlus, IconUserCheck, IconX } from '@tabler/icons-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenWorkflowGuide: () => void;
  onQuickAction: (action: 'customer' | 'job' | 'request' | 'quote' | 'invoice') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenWorkflowGuide,
  onQuickAction,
}) => {
  const { currentUser, switchUserRole, users, notifications, realAuth, logout } = useApp(['currentUser', 'switchUserRole', 'users', 'notifications', 'realAuth', 'logout']);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  // Escape or a click outside the header closes any open menu.
  useEffect(() => {
    if (!quickMenuOpen && !roleMenuOpen && !mobileMenuOpen) return;
    const closeAll = () => { setQuickMenuOpen(false); setRoleMenuOpen(false); setMobileMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    const onDown = (e: MouseEvent) => { if (!headerRef.current?.contains(e.target as Node)) closeAll(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [quickMenuOpen, roleMenuOpen, mobileMenuOpen]);

  const pendingNotifications = notifications.filter((n) => n.status === 'ready_to_send').length;

  const visibleLinks = navLinks.filter((l) => l.allowedRoles.includes(currentUser.role));

  const roleLabels: Record<UserRole, { label: string; desc: string; color: string }> = {
    admin: { label: 'Business Owner / Admin', desc: 'Full access to operations, finances & settings', color: 'bg-emerald-600 text-white' },
    dispatcher: { label: 'Office Manager / Dispatcher', desc: 'Manage jobs, calendar, customers & requests', color: 'bg-sky-600 text-white' },
    technician: { label: 'Field Technician', desc: 'Mobile-first job view, checklists & signatures', color: 'bg-indigo-600 text-white' },
    accountant: { label: 'Accountant', desc: 'Quotations, invoices, VAT & payment ledgers', color: 'bg-amber-600 text-white' },
  };

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
  const quickItems = [
    { action: 'request', label: 'Service Request', hint: 'Enquiry' },
    { action: 'job', label: 'Book Job', hint: 'Dispatch' },
    { action: 'customer', label: 'Add Customer', hint: 'Client' },
    { action: 'quote', label: 'Quotation', hint: 'Estimate', divider: true },
    { action: 'invoice', label: 'Invoice', hint: 'Billing' },
  ] as const;

  const brandButton = (
    <button
      onClick={() => onSelectTab(currentUser.role === 'technician' ? 'technician_portal' : 'dashboard')}
      className={`flex items-center gap-2.5 text-left group rounded-md ${focusRing}`}
    >
      <div className="w-9 h-9 rounded-lg bg-sky-700 text-white flex items-center justify-center shadow-xs">
        <IconFlame className="w-5 h-5 text-amber-300" aria-hidden="true" />
      </div>
      <div className="hidden sm:flex flex-col">
        <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-sky-700 transition-colors whitespace-nowrap">
          ApexHVAC
        </span>
        <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
          Field Service UK
        </span>
      </div>
    </button>
  );

  return (
    <>
      {/* Left Sidebar Navigation (desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-white border-r border-slate-200">
        <div className="h-16 flex items-center px-4 border-b border-slate-200 shrink-0">
          {brandButton}
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              aria-current={currentTab === item.id ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${focusRing} ${
                currentTab === item.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

    <header ref={headerRef} className="sticky top-0 z-30 bg-white border-b border-slate-200 lg:pl-60">
      {/* Top 3-Zone Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between lg:justify-end h-16 gap-4">
          
          {/* Brand Wordmark (mobile only; desktop brand lives in sidebar) */}
          <div className="lg:hidden flex items-center gap-3 shrink-0">
            {brandButton}
          </div>

          {/* Zone 3: Actions & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Workflow Guide Trigger */}
            {!realAuth && (
              <button
                onClick={onOpenWorkflowGuide}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors ${focusRing}`}
                title="Test End-to-End HVAC Workflows (A, B, C, D)"
              >
                <IconHelp className="w-4 h-4 text-sky-600" aria-hidden="true" />
                <span className="hidden sm:inline">Workflow Demo</span>
              </button>
            )}

            {/* Notifications Shortcut */}
            <button
              onClick={() => { useDataStore.getState().load('notifications'); onSelectTab('notifications'); }} // the server creates notifications (e.g. on quote send), so refetch on open
              aria-label={pendingNotifications > 0 ? `Customer notifications, ${pendingNotifications} pending` : 'Customer notifications'}
              className={`relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors ${focusRing}`}
              title="Customer Notifications"
            >
              <IconBell className="w-4 h-4" aria-hidden="true" />
              {pendingNotifications > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>

            {/* Quick Action "+ New" Button (hidden for technicians) */}
            {currentUser.role !== 'technician' && (
              <div className="relative">
                <button
                  onClick={() => { setQuickMenuOpen(!quickMenuOpen); setRoleMenuOpen(false); }}
                  aria-label="New"
                  aria-haspopup="true"
                  aria-expanded={quickMenuOpen}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-xs transition-colors whitespace-nowrap ${focusRing}`}
                >
                  <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">New</span>
                </button>

                {quickMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Quick Create
                    </div>
                    {quickItems.map((item) => (
                      <React.Fragment key={item.action}>
                        {'divider' in item && <div className="border-t border-slate-100 my-1" />}
                        <button
                          onClick={() => {
                            onQuickAction(item.action);
                            setQuickMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between ${focusRing}`}
                        >
                          <span>{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.hint}</span>
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Role Switcher IconMenu2 */}
            <div className="relative">
              <button
                onClick={() => { setRoleMenuOpen(!roleMenuOpen); setQuickMenuOpen(false); }}
                aria-haspopup="true"
                aria-expanded={roleMenuOpen}
                className={`flex items-center gap-2 px-2.5 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors text-left ${focusRing}`}
                title={realAuth ? 'Account' : 'Switch active user & role to test permissions'}
              >
                <div className="w-6 h-6 rounded bg-slate-900 text-white text-xs flex items-center justify-center font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {currentUser.role}
                  </span>
                </div>
                <IconUserCheck className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50">
                  {realAuth ? (
                    <div className="space-y-1">
                      <div className="px-2 py-1.5 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900">{currentUser.name}</p>
                        <p className="text-[11px] text-slate-500">{currentUser.email} · <span className="capitalize">{currentUser.role}</span></p>
                      </div>
                      <button
                        onClick={logout}
                        className={`w-full flex items-center gap-2 px-2 py-2 text-xs font-medium text-slate-700 rounded-md hover:bg-slate-50 ${focusRing}`}
                      >
                        <IconLogout className="w-3.5 h-3.5" aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  ) : (
                  <>
                  <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                    <p className="text-xs font-semibold text-slate-900">Switch User & Role</p>
                    <p className="text-[11px] text-slate-500">Test multi-role permissions in real time</p>
                  </div>
                  <div className="space-y-1">
                    {users.map((u) => {
                      const isCurrent = u.id === currentUser.id;
                      const roleMeta = roleLabels[u.role];
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            switchUserRole(u.role);
                            setRoleMenuOpen(false);
                          }}
                          aria-current={isCurrent ? 'true' : undefined}
                          className={`w-full text-left p-2 rounded-md transition-colors ${focusRing} ${
                            isCurrent ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">{u.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${roleMeta.color}`}>
                              {u.role.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{roleMeta.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className={`lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md ${focusRing}`}
            >
              {mobileMenuOpen ? <IconX className="w-5 h-5" aria-hidden="true" /> : <IconMenu2 className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer IconMenu2 */}
      {mobileMenuOpen && (
        <nav aria-label="Mobile" className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {visibleLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              aria-current={currentTab === item.id ? 'page' : undefined}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md ${focusRing} ${
                currentTab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Signed in as: {currentUser.name}</span>
            <span className="font-semibold capitalize text-sky-700">{currentUser.role}</span>
          </div>
        </nav>
      )}
    </header>
    </>
  );
};
