/** Response of GET /analytics/overview. Money is in MAJOR units (see overview.service.ts). */
export interface OverviewData {
  days: number;
  timezone: string;
  generatedAt: string;
  revenue: {
    currency: string;
    mixedCurrency: boolean;
    total: number;
    previousTotal: number;
    deltaPct: number | null;
    paymentCount: number;
    series: { date: string; value: number }[];
    openPipeline: { value: number; deals: number };
  };
  leads: { total: number; previous: number; deltaPct: number | null; open: number };
  conversion: { rate: number; won: number; leads: number; previousRate: number; deltaPoints: number | null };
  followUps: {
    total: number;
    overdue: number;
    breakdown: { tasks: number; leads: number; deals: number; waitingConversations: number };
    items: { id: string; kind: 'task' | 'lead' | 'deal'; title: string; note: string | null; dueAt: string; overdue: boolean; contact: string; href: string }[];
  };
  activity: { date: string; inbound: number; human: number; ai: number }[];
  funnel: { key: string; label: string; count: number; rate: number }[];
  recentConversations: {
    id: string; contact: string; lastMessage: string | null; lastMessageAt: string;
    status: string; aiEnabled: boolean; unread: number; assignee: string | null;
  }[];
  agents: {
    ai: { replies: number; actions: number; tokens: number; avgLatencyMs: number | null; handlingNow: number; escalated: number };
    team: { id: string; name: string; messages: number; tasksDone: number; dealsWon: number; score: number }[];
    recent: { id: string; kind: 'lead' | 'deal' | 'task'; title: string; at: string; href: string }[];
  };
}
