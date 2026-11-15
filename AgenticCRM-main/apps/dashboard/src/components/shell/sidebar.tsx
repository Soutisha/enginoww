'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { isAdminRole, NAV_SECTIONS, canAccess, type NavSection } from './nav-config';

type U = { firstName?: string; lastName?: string; role?: string; permissions?: string[] } | null;

function useVisibleSections(user: U): NavSection[] {
  return NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => canAccess(user, i.perm)) }))
    .filter((s) => s.items.length > 0);
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

function NavLinks({ pathname, user, collapsed, onNavigate }: { pathname: string; user: U; collapsed: boolean; onNavigate?: () => void }) {
  const sections = useVisibleSections(user);
  return (
    <nav aria-label="Main" className="scroll-thin flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {sections.map((section) => (
        <div key={section.label}>
          {!collapsed ? (
            <p className="mb-1 px-2.5 text-[11px] font-medium text-ink-faint">{section.label}</p>
          ) : (
            <div className="mx-auto mb-1 h-px w-5 bg-line" aria-hidden />
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ href, icon: Icon, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                      collapsed && 'justify-center px-0',
                      active ? 'bg-signal/12 text-ink' : 'text-ink-dim hover:bg-raised hover:text-ink',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-signal"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                    <Icon size={16} className={cn('shrink-0', active && 'text-signal')} aria-hidden />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({
  pathname, user, collapsed, onToggle, onLogout, onNavigate, onClose,
}: {
  pathname: string; user: U; collapsed: boolean; onToggle?: () => void;
  onLogout: () => void; onNavigate?: () => void; onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <Image src="/logo.png" alt="" width={24} height={24} className="shrink-0 invert" unoptimized />
        {!collapsed && <span className="flex-1 truncate text-sm font-semibold tracking-tight text-ink">AgenticCRM</span>}
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="rounded-md p-1 text-ink-dim hover:bg-raised hover:text-ink">
            <X size={18} />
          </button>
        )}
      </div>

      <NavLinks pathname={pathname} user={user} collapsed={collapsed} onNavigate={onNavigate} />

      <div className="space-y-0.5 border-t border-line p-2">
        {isAdminRole(user?.role) && (
          <Link
            href="/settings"
            onClick={onNavigate}
            title={collapsed ? 'Settings' : undefined}
            aria-label={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
              collapsed && 'justify-center px-0',
              pathname.startsWith('/settings') ? 'bg-signal/12 text-ink' : 'text-ink-dim hover:bg-raised hover:text-ink',
            )}
          >
            <Settings size={16} aria-hidden />
            {!collapsed && 'Settings'}
          </Link>
        )}
        <div className={cn('flex items-center gap-2.5 px-2.5 py-2', collapsed && 'justify-center px-0')}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-signal/20 text-xs font-semibold text-signal" aria-hidden>
            {user?.firstName?.[0]}
          </span>
          {!collapsed && (
            <>
              <p className="min-w-0 flex-1 truncate text-[13px] text-ink">{user?.firstName} {user?.lastName}</p>
              <button onClick={onLogout} aria-label="Sign out" title="Sign out" className="rounded-md p-1 text-ink-faint hover:bg-raised hover:text-ink">
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('hidden w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-ink-faint transition-colors hover:bg-raised hover:text-ink lg:flex', collapsed && 'justify-center px-0')}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && 'Collapse'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Desktop rail (lg+) — collapsible, width animates. */
export function DesktopSidebar(props: { pathname: string; user: U; collapsed: boolean; onToggle: () => void; onLogout: () => void }) {
  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'hidden shrink-0 border-r border-line bg-panel transition-[width] duration-200 ease-out lg:block',
        props.collapsed ? 'w-[60px]' : 'w-60',
      )}
    >
      <SidebarBody {...props} />
    </aside>
  );
}

/** Mobile drawer (<lg). */
export function MobileDrawer({
  open, onClose, ...props
}: { open: boolean; onClose: () => void; pathname: string; user: U; onLogout: () => void }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <motion.div
            className="absolute inset-0 bg-canvas/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog" aria-modal="true" aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-panel"
            initial={reduce ? false : { x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <SidebarBody {...props} collapsed={false} onNavigate={onClose} onClose={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
