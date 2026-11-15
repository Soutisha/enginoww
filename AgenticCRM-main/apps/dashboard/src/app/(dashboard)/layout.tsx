import { AppShell } from '@/components/shell/app-shell';

// The shell is a client component (auth gating, sockets, collapse state); the layout stays a thin wrapper.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
