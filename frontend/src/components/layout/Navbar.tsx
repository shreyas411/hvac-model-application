import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { navLinks, quickCreateRoles } from '../../routes';
import { SyncBanner } from './SyncBanner';
import { useDataStore } from '../../store/useDataStore';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/src/components/ui/sheet';
import { cn } from '@/src/lib/utils';
import { IconBell, IconFlame, IconHelp, IconLogout, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconMenu2, IconPlus, IconUserCheck, IconX } from '@tabler/icons-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenWorkflowGuide: () => void;
  onQuickAction: (action: 'customer' | 'job' | 'request' | 'quote' | 'invoice') => void;
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenWorkflowGuide,
  onQuickAction,
  collapsed,
  onToggleSidebar,
}) => {
  const { currentUser, switchUserRole, users, notifications, realAuth, logout } = useApp(['currentUser', 'switchUserRole', 'users', 'notifications', 'realAuth', 'logout']);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // A user record without a name must not blank the whole screen (seen once in test builds; cause not found).
  const displayName = currentUser.name || currentUser.email || 'User';
  const pendingNotifications = notifications.filter((n) => n.status === 'ready_to_send').length;

  const visibleLinks = navLinks.filter((l) => l.allowedRoles.includes(currentUser.role));

  const roleLabels: Record<UserRole, { label: string; desc: string; color: string }> = {
    admin: { label: 'Business Owner / Admin', desc: 'Full access to operations, finances & settings', color: 'bg-emerald-600 text-white' },
    dispatcher: { label: 'Office Manager / Dispatcher', desc: 'Manage jobs, calendar, customers & requests', color: 'bg-sky-600 text-white' },
    technician: { label: 'Field Technician', desc: 'Mobile-first job view, checklists & signatures', color: 'bg-indigo-600 text-white' },
    accountant: { label: 'Accountant', desc: 'Quotations, invoices, VAT & payment ledgers', color: 'bg-amber-600 text-white' },
  };

  const quickItems = ([
    { action: 'request', label: 'Service Request', hint: 'Enquiry' },
    { action: 'job', label: 'Book Job', hint: 'Dispatch' },
    { action: 'customer', label: 'Add Customer', hint: 'Client' },
    { action: 'quote', label: 'Quotation', hint: 'Estimate', divider: true },
    { action: 'invoice', label: 'Invoice', hint: 'Billing' },
  ] as const).filter((i) => quickCreateRoles[i.action].includes(currentUser.role));

  const brandButton = (
    <Button
      variant="ghost"
      onClick={() => onSelectTab(currentUser.role === 'technician' ? 'technician_portal' : 'dashboard')}
      className="h-auto gap-2.5 p-1 text-left group hover:bg-transparent"
    >
      <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
        <IconFlame className="w-5 h-5 text-amber-300" aria-hidden="true" />
      </div>
      <div className={`${collapsed ? 'lg:hidden' : ''} hidden sm:flex flex-col`}>
        <span className="text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
          ApexHVAC
        </span>
        <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
          Field Service UK
        </span>
      </div>
    </Button>
  );

  const navItemClass = (active: boolean) => active ? 'bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary' : 'text-muted-foreground';
  return (
    <>
      {/* Left Sidebar Navigation (desktop) */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-40 ${collapsed ? 'w-16' : 'w-60'} flex-col transition-[width] bg-background border-r border-border`}>
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-4'} border-b border-border shrink-0`}>
          {brandButton}
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleLinks.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => onSelectTab(item.id)}
              aria-current={currentTab === item.id ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className={cn('w-full', collapsed ? 'justify-center' : 'justify-start', navItemClass(currentTab === item.id))}
            >
              <item.icon aria-hidden="true" />
              {!collapsed && item.label}
            </Button>
          ))}
        </nav>
        <Button
          variant="ghost"
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('m-3 text-muted-foreground', collapsed ? 'justify-center' : 'justify-start')}
        >
          {collapsed ? <IconLayoutSidebarLeftExpand aria-hidden="true" /> : <><IconLayoutSidebarLeftCollapse aria-hidden="true" />Collapse</>}
        </Button>
      </aside>

    <header className={`sticky top-0 z-30 bg-background border-b border-border ${collapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
      {/* Top 3-Zone Navigation */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between lg:justify-end h-16 gap-4">
          
          {/* Brand Wordmark (mobile only; desktop brand lives in sidebar) */}
          <div className="lg:hidden flex items-center gap-3 shrink-0">
            {brandButton}
          </div>

          {/* Zone 3: Actions & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Workflow Guide Trigger */}
            <Button variant="ghost" size="sm" onClick={onOpenWorkflowGuide} title="Test End-to-End HVAC Workflows (A, B, C, D)">
              <IconHelp className="text-primary" aria-hidden="true" />
              <span className="hidden sm:inline">Workflow Demo</span>
            </Button>

            {/* Notifications Shortcut */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => { useDataStore.getState().load('notifications'); onSelectTab('notifications'); }} // the server creates notifications (e.g. on quote send), so refetch on open
              aria-label={pendingNotifications > 0 ? `Customer notifications, ${pendingNotifications} pending` : 'Customer notifications'}
              className="relative text-muted-foreground"
              title="Customer Notifications"
            >
              <IconBell aria-hidden="true" />
              {pendingNotifications > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </Button>

            {/* Quick Action "+ New" Button (hidden when the role can create nothing) */}
            {quickItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" aria-label="New">
                    <IconPlus aria-hidden="true" />
                    <span className="hidden sm:inline">New</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">Quick Create</DropdownMenuLabel>
                  {quickItems.map((item) => (
                    <React.Fragment key={item.action}>
                      {'divider' in item && <DropdownMenuSeparator />}
                      <DropdownMenuItem onSelect={() => onQuickAction(item.action)} className="justify-between text-xs">
                        <span>{item.label}</span>
                        <span className="text-[10px] text-muted-foreground">{item.hint}</span>
                      </DropdownMenuItem>
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Account / Role Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-auto gap-2 px-2.5 py-1.5 text-left" title={realAuth ? 'Account' : 'Switch active user & role to test permissions'}>
                  <div className="w-6 h-6 rounded bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    {displayName.charAt(0)}
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-xs font-semibold leading-tight">{displayName.split(' ')[0]}</span>
                    <span className="text-[10px] text-muted-foreground capitalize font-normal">{currentUser.role}</span>
                  </div>
                  <IconUserCheck className="text-muted-foreground" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {realAuth ? (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-xs font-semibold">{currentUser.name}</p>
                      <p className="text-[11px] text-muted-foreground">{currentUser.email} · <span className="capitalize">{currentUser.role}</span></p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={logout} className="text-xs"><IconLogout aria-hidden="true" />Sign out</DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-xs font-semibold">Switch User & Role</p>
                      <p className="text-[11px] text-muted-foreground">Test multi-role permissions in real time</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {users.map((u) => {
                      const roleMeta = roleLabels[u.role];
                      return (
                        <DropdownMenuItem
                          key={u.id}
                          onSelect={() => switchUserRole(u.role)}
                          aria-current={u.id === currentUser.id ? 'true' : undefined}
                          className="flex-col items-stretch gap-0.5 aria-[current=true]:bg-accent"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{u.name}</span>
                            <Badge className={cn('text-[10px] px-1.5 py-0', roleMeta.color)}>{u.role.toUpperCase()}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{roleMeta.desc}</p>
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Hamburger Button */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden"
            >
              <IconMenu2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 lg:hidden">
          <SheetHeader>
            <SheetTitle>ApexHVAC</SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </SheetHeader>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 space-y-1">
            {visibleLinks.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                onClick={() => { onSelectTab(item.id); setMobileMenuOpen(false); }}
                aria-current={currentTab === item.id ? 'page' : undefined}
                className={cn('w-full justify-start', navItemClass(currentTab === item.id))}
              >
                <item.icon aria-hidden="true" />
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Signed in as: {currentUser.name}</span>
            <span className="font-semibold capitalize text-primary">{currentUser.role}</span>
          </div>
        </SheetContent>
      </Sheet>
      <SyncBanner />
    </header>
    </>
  );
};
