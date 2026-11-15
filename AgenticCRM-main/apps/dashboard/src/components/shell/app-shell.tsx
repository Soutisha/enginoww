'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpCircle, Menu, ShieldOff, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { EmptyState, PageTransition } from '@/components/ui';
import { useSocket } from '@/hooks/use-socket';
import api from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess, findNavItem, firstAllowedHref, isAdminRole, MIGRATED_ROUTES } from './nav-config';
import { DesktopSidebar, MobileDrawer } from './sidebar';
import { NotificationCenter } from './notification-center';

const COLLAPSE_KEY = 'sidebar_collapsed';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, logout, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const admin = isAdminRole(user?.role);

  useEffect(() => {
    setMounted(true);
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage unavailable */ }
  }, []);
  useSocket();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  }, []);

  const handleLogout = useCallback(() => { logout(); router.push('/login'); }, [logout, router]);

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Update check (admins only), every 30 min.
  const { data: updateInfo } = useQuery({
    queryKey: ['system-update-check'],
    queryFn: () => api.get('/system/check-update').then((r) => r.data.data),
    enabled: mounted && admin,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const showUpdateBanner = updateInfo?.updateAvailable && !dismissedUpdate;

  // Auth + permission gating. Unpermitted routes send the user to the first page they CAN open
  // (not blindly to /chat, which they may not have access to either).
  const navItem = findNavItem(pathname);
  const blocked =
    mounted && !!user &&
    ((!admin && pathname.startsWith('/settings')) ||
      (!!navItem && navItem.href !== '/chat' && !canAccess(user, navItem.perm)));
  const fallback = blocked ? firstAllowedHref(user) : null;

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { router.push('/login'); return; }
    if (blocked && fallback && fallback !== pathname) router.replace(fallback);
  }, [mounted, isAuthenticated, blocked, fallback, pathname, router]);

  if (!mounted || !isAuthenticated()) return null;

  const migrated = MIGRATED_ROUTES.has(pathname);
  const title = navItem?.label ?? (pathname.startsWith('/settings') ? 'Settings' : '');

  return (
    <div className="app-atmosphere relative flex h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-signal focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      <DesktopSidebar pathname={pathname} user={user} collapsed={collapsed} onToggle={toggleCollapsed} onLogout={handleLogout} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={pathname} user={user} onLogout={handleLogout} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: mobile menu + page title. */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 lg:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-1 rounded-md p-1.5 text-ink-dim hover:bg-raised hover:text-ink lg:hidden"
          >
            <Menu size={20} />
          </button>
          <h1 className="truncate text-sm font-medium text-ink">{title}</h1>
          <NotificationCenter />
        </header>

        {showUpdateBanner && (
          <div role="status" className="flex items-center justify-between gap-3 border-b border-line bg-signal/10 px-4 py-2 text-xs text-ink">
            <span className="flex items-center gap-2">
              <ArrowUpCircle size={14} className="text-signal" aria-hidden />
              <strong className="font-medium">Update available</strong>
              {updateInfo.latest?.message && <span className="hidden text-ink-dim sm:inline">{updateInfo.latest.message}</span>}
            </span>
            <span className="flex items-center gap-2">
              <Link href="/settings/system" className="rounded-md bg-signal px-2.5 py-1 font-medium text-primary-foreground hover:bg-signal/90">
                Update now
              </Link>
              <button onClick={() => setDismissedUpdate(true)} aria-label="Dismiss update notice" className="text-ink-dim hover:text-ink">
                <X size={14} />
              </button>
            </span>
          </div>
        )}

        <main id="main" tabIndex={-1} className="dashboard-scroll scroll-thin min-h-0 flex-1 overflow-auto outline-none">
          {blocked && !fallback ? (
            <EmptyState
              icon={ShieldOff}
              title="You don't have access to any pages yet"
              description="Ask an administrator to grant your account permissions."
              className="py-24"
            />
          ) : migrated ? (
            <PageTransition routeKey={pathname}>
              <div className="mx-auto w-full max-w-[1400px] p-4 lg:p-6">{children}</div>
            </PageTransition>
          ) : (
            // Pages not yet moved to the dark system keep their original light styling.
            <div className="legacy-canvas min-h-full bg-[#fafafa] lg:rounded-tl-2xl">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}
