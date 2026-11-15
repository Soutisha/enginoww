import {
  MessageSquare, MessagesSquare, PhoneCall, Users, TrendingUp, Briefcase, CheckSquare, BarChart3, Megaphone, Sparkles,
  CreditCard, FileText, Repeat, Package, Store, Receipt, FileSpreadsheet, Target, Clipboard,
  Workflow, LifeBuoy, BookOpen, PieChart, Plug, FolderOpen, Brain, Terminal, LayoutDashboard, Bot, Orbit,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem { href: string; icon: LucideIcon; label: string; perm: string }
export interface NavSection { label: string; items: NavItem[] }

/** Routes already rendered on the dark design system. Everything else sits on the legacy light canvas. */
export const MIGRATED_ROUTES: ReadonlySet<string> = new Set(['/', '/command-centre']);

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard', perm: 'analytics' },
      { href: '/analytics', icon: BarChart3, label: 'Analytics', perm: 'analytics' },
      { href: '/reports', icon: PieChart, label: 'Reports', perm: 'reports' },
      { href: '/command-centre', icon: Orbit, label: '3D Command Centre', perm: 'analytics' },
    ],
  },
  {
    label: 'Assistant',
    items: [
      { href: '/chat', icon: MessageSquare, label: 'AI Chat', perm: 'ai_chat' },
      { href: '/inbox', icon: MessagesSquare, label: 'WhatsApp Inbox', perm: 'whatsapp' },
      { href: '/memory', icon: Brain, label: 'Memory', perm: 'memory' },
      { href: '/knowledge', icon: Brain, label: 'Business Brain', perm: 'memory' },
      { href: '/docs', icon: Terminal, label: 'AI Commands', perm: 'ai_chat' },
      { href: '/agents', icon: Bot, label: 'AI Workforce', perm: 'ai_chat' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/contacts', icon: Users, label: 'Contacts', perm: 'contacts' },
      { href: '/leads', icon: TrendingUp, label: 'Leads', perm: 'leads' },
      { href: '/calls', icon: PhoneCall, label: 'Call CRM', perm: 'leads' },
      { href: '/deals', icon: Briefcase, label: 'Deals', perm: 'deals' },
      { href: '/tasks', icon: CheckSquare, label: 'Tasks', perm: 'tasks' },
      { href: '/products', icon: Package, label: 'Products', perm: 'products' },
      { href: '/storefront', icon: Store, label: 'Storefront', perm: 'products' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { href: '/broadcasts', icon: Megaphone, label: 'Broadcasts', perm: 'broadcasts' },
      { href: '/templates', icon: FileText, label: 'Templates', perm: 'templates' },
      { href: '/sequences', icon: Repeat, label: 'Sequences', perm: 'sequences' },
      { href: '/campaigns', icon: Target, label: 'Campaigns', perm: 'campaigns' },
      { href: '/marketing', icon: Sparkles, label: 'Marketing Studio', perm: 'products' },
      { href: '/forms', icon: Clipboard, label: 'Forms', perm: 'forms' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/quotes', icon: Receipt, label: 'Quotes', perm: 'quotes' },
      { href: '/invoices', icon: FileSpreadsheet, label: 'Invoices', perm: 'invoices' },
      { href: '/payments', icon: CreditCard, label: 'Payments', perm: 'payments' },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/tickets', icon: LifeBuoy, label: 'Tickets', perm: 'tickets' },
      { href: '/kb', icon: BookOpen, label: 'Knowledge Base', perm: 'kb' },
    ],
  },
  {
    label: 'Automate',
    items: [{ href: '/workflows', icon: Workflow, label: 'Workflows', perm: 'workflows' }],
  },
  {
    label: 'More',
    items: [
      { href: '/documents', icon: FolderOpen, label: 'Documents', perm: 'documents' },
      { href: '/integrations', icon: Plug, label: 'Integrations', perm: 'integrations' },
    ],
  },
];

export const isAdminRole = (role?: string) => role === 'SUPER_ADMIN' || role === 'ADMIN';

export function canAccess(user: { role?: string; permissions?: string[] } | null, perm: string) {
  if (!user) return false;
  return isAdminRole(user.role) || (user.permissions ?? []).includes(perm);
}

/** Longest-prefix match, so /leads/api-keys resolves to Leads rather than nothing. */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const s of NAV_SECTIONS) {
    for (const i of s.items) {
      const hit = i.href === '/' ? pathname === '/' : pathname === i.href || pathname.startsWith(i.href + '/');
      if (hit && (!best || i.href.length > best.href.length)) best = i;
    }
  }
  return best;
}

export function firstAllowedHref(user: { role?: string; permissions?: string[] } | null): string | null {
  for (const s of NAV_SECTIONS) for (const i of s.items) if (canAccess(user, i.perm)) return i.href;
  return null;
}
