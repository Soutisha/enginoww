import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@wacrm/database';

/**
 * Home-dashboard payload — one round trip, everything company-scoped.
 *
 * Money is returned in MAJOR units (rupees, not paise) with an explicit currency:
 *   - Payment.amount is stored in minor units (paise) → divided by 100 here.
 *   - Deal.value is stored in major units already → passed through.
 * Keeping this conversion in one place stops the UI from guessing.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_LEAD = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING'] as const;
const OPEN_TASK = ['TODO', 'IN_PROGRESS'] as const;

type Range = { start: Date; end: Date };

/** YYYY-MM-DD for a date as seen in `tz` (falls back to UTC for an invalid zone). */
function dayKey(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function dayKeys(range: Range, tz: string): string[] {
  const keys: string[] = [];
  for (let t = range.start.getTime(); t <= range.end.getTime() + DAY_MS - 1; t += DAY_MS) {
    const k = dayKey(new Date(t), tz);
    if (keys[keys.length - 1] !== k && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

const pctChange = (cur: number, prev: number): number | null =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

const fullName = (p?: { firstName?: string | null; lastName?: string | null; displayName?: string | null; phoneNumber?: string | null } | null) =>
  p ? ([p.firstName, p.lastName].filter(Boolean).join(' ') || p.displayName || p.phoneNumber || 'Unknown') : 'Unknown';

@Injectable()
export class OverviewService {
  async getOverview(companyId: string, rawDays = 30) {
    const days = Math.min(Math.max(Math.trunc(rawDays) || 30, 1), 90);
    const now = new Date();
    const range: Range = { start: new Date(now.getTime() - days * DAY_MS), end: now };
    const prev: Range = { start: new Date(range.start.getTime() - days * DAY_MS), end: range.start };

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
    const tz = company?.timezone || 'UTC';

    const [revenue, leads, conversion, followUps, activity, funnel, recentConversations, agents] = await Promise.all([
      this.revenue(companyId, range, prev, tz),
      this.leads(companyId, range, prev),
      this.conversion(companyId, range, prev),
      this.followUps(companyId, now),
      this.dailyActivity(companyId, range, tz),
      this.funnel(companyId, range),
      this.recentConversations(companyId),
      this.agentActivity(companyId, range),
    ]);

    return { days, timezone: tz, generatedAt: now.toISOString(), revenue, leads, conversion, followUps, activity, funnel, recentConversations, agents };
  }

  // ── Revenue ────────────────────────────────────────────────────────────────
  private async revenue(companyId: string, range: Range, prev: Range, tz: string) {
    const [current, previous, pipeline] = await Promise.all([
      prisma.payment.findMany({
        where: { companyId, status: 'PAID', paidAt: { gte: range.start, lte: range.end } },
        select: { paidAt: true, amount: true, refundedAmount: true, currency: true },
      }),
      prisma.payment.findMany({
        where: { companyId, status: 'PAID', paidAt: { gte: prev.start, lt: prev.end } },
        select: { amount: true, refundedAmount: true, currency: true },
      }),
      prisma.deal.aggregate({
        where: { companyId, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } },
        _sum: { value: true },
        _count: true,
      }),
    ]);

    // Report in the currency that earned the most; flag when others exist rather than silently adding rupees to dollars.
    const byCurrency = new Map<string, number>();
    for (const p of current) byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + p.amount - p.refundedAmount);
    const currency = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INR';
    const net = (p: { amount: number; refundedAmount: number }) => (p.amount - p.refundedAmount) / 100;

    const inCur = current.filter((p) => p.currency === currency);
    const perDay = new Map<string, number>();
    for (const p of inCur) {
      const k = dayKey(p.paidAt!, tz);
      perDay.set(k, (perDay.get(k) ?? 0) + net(p));
    }
    const total = inCur.reduce((s, p) => s + net(p), 0);
    const previousTotal = previous.filter((p) => p.currency === currency).reduce((s, p) => s + net(p), 0);

    return {
      currency,
      mixedCurrency: byCurrency.size > 1,
      total,
      previousTotal,
      deltaPct: pctChange(total, previousTotal),
      paymentCount: inCur.length,
      series: dayKeys(range, tz).map((date) => ({ date, value: Math.round((perDay.get(date) ?? 0) * 100) / 100 })),
      openPipeline: { value: pipeline._sum.value ?? 0, deals: pipeline._count },
    };
  }

  // ── Leads & conversion ─────────────────────────────────────────────────────
  private async leads(companyId: string, range: Range, prev: Range) {
    const [total, previous, open] = await Promise.all([
      prisma.lead.count({ where: { companyId, deletedAt: null, createdAt: { gte: range.start, lte: range.end } } }),
      prisma.lead.count({ where: { companyId, deletedAt: null, createdAt: { gte: prev.start, lt: prev.end } } }),
      prisma.lead.count({ where: { companyId, deletedAt: null, status: { in: [...OPEN_LEAD] } } }),
    ]);
    return { total, previous, deltaPct: pctChange(total, previous), open };
  }

  /** Cohort conversion: of leads created in the period, how many are now WON. */
  private async conversion(companyId: string, range: Range, prev: Range) {
    const q = async (r: Range, upper: 'lte' | 'lt') => {
      const where = { companyId, deletedAt: null, createdAt: { gte: r.start, [upper]: r.end } };
      const [total, won] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { ...where, status: 'WON' as const } }),
      ]);
      return { total, won, rate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0 };
    };
    const [cur, before] = await Promise.all([q(range, 'lte'), q(prev, 'lt')]);
    return {
      rate: cur.rate, won: cur.won, leads: cur.total, previousRate: before.rate,
      // Percentage-point change; null when there is no prior cohort to compare to.
      deltaPoints: before.total > 0 ? Math.round((cur.rate - before.rate) * 10) / 10 : null,
    };
  }

  // ── Pending follow-ups: overdue or due within 24h ──────────────────────────
  private async followUps(companyId: string, now: Date) {
    const horizon = new Date(now.getTime() + DAY_MS);
    const taskWhere = { companyId, status: { in: [...OPEN_TASK] }, dueAt: { not: null, lte: horizon } };
    const leadWhere = { companyId, deletedAt: null, status: { in: [...OPEN_LEAD] }, nextActionAt: { not: null, lte: horizon } };
    const dealWhere = { companyId, deletedAt: null, stage: { notIn: ['WON', 'LOST'] as ('WON' | 'LOST')[] }, nextActionAt: { not: null, lte: horizon } };

    const [taskCount, leadCount, dealCount, waitingHuman, tasks, leadRows, deals] = await Promise.all([
      prisma.task.count({ where: taskWhere }),
      prisma.lead.count({ where: leadWhere }),
      prisma.deal.count({ where: dealWhere }),
      prisma.conversation.count({ where: { companyId, status: 'WAITING_HUMAN' } }),
      prisma.task.findMany({
        where: taskWhere, orderBy: { dueAt: 'asc' }, take: 6,
        select: { id: true, title: true, dueAt: true, priority: true, contact: { select: { displayName: true, firstName: true, lastName: true, phoneNumber: true } } },
      }),
      prisma.lead.findMany({
        where: leadWhere, orderBy: { nextActionAt: 'asc' }, take: 6,
        select: { id: true, title: true, nextActionAt: true, nextActionNote: true, contact: { select: { displayName: true, firstName: true, lastName: true, phoneNumber: true } } },
      }),
      prisma.deal.findMany({
        where: dealWhere, orderBy: { nextActionAt: 'asc' }, take: 6,
        select: { id: true, title: true, nextActionAt: true, nextActionNote: true, contact: { select: { displayName: true, firstName: true, lastName: true, phoneNumber: true } } },
      }),
    ]);

    const items = [
      ...tasks.map((t) => ({ id: t.id, kind: 'task' as const, title: t.title, note: null as string | null, dueAt: t.dueAt!, contact: fullName(t.contact), href: `/tasks/${t.id}` })),
      ...leadRows.map((l) => ({ id: l.id, kind: 'lead' as const, title: l.title, note: l.nextActionNote, dueAt: l.nextActionAt!, contact: fullName(l.contact), href: `/leads/${l.id}` })),
      ...deals.map((d) => ({ id: d.id, kind: 'deal' as const, title: d.title, note: d.nextActionNote, dueAt: d.nextActionAt!, contact: fullName(d.contact), href: `/deals/${d.id}` })),
    ]
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, 6)
      .map((i) => ({ ...i, dueAt: i.dueAt.toISOString(), overdue: i.dueAt.getTime() < now.getTime() }));

    const [overdueTasks, overdueLeads, overdueDeals] = await Promise.all([
      prisma.task.count({ where: { ...taskWhere, dueAt: { lt: now } } }),
      prisma.lead.count({ where: { ...leadWhere, nextActionAt: { lt: now } } }),
      prisma.deal.count({ where: { ...dealWhere, nextActionAt: { lt: now } } }),
    ]);

    return {
      total: taskCount + leadCount + dealCount + waitingHuman,
      overdue: overdueTasks + overdueLeads + overdueDeals,
      breakdown: { tasks: taskCount, leads: leadCount, deals: dealCount, waitingConversations: waitingHuman },
      items,
    };
  }

  // ── Daily message activity ─────────────────────────────────────────────────
  private async dailyActivity(companyId: string, range: Range, tz: string) {
    // Grouped in SQL: a busy account can have 100k+ messages in 90 days.
    const rows = await prisma.$queryRaw<Array<{ day: string; inbound: number; human: number; ai: number }>>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS day,
             count(*) FILTER (WHERE direction = 'INBOUND')::int AS inbound,
             count(*) FILTER (WHERE direction = 'OUTBOUND' AND NOT "isAiGenerated")::int AS human,
             count(*) FILTER (WHERE direction = 'OUTBOUND' AND "isAiGenerated")::int AS ai
      FROM "Message"
      WHERE "companyId" = ${companyId} AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
      GROUP BY 1
    `);
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return dayKeys(range, tz).map((date) => {
      const r = byDay.get(date);
      return { date, inbound: r?.inbound ?? 0, human: r?.human ?? 0, ai: r?.ai ?? 0 };
    });
  }

  // ── Funnel (cohort of leads created in range) ──────────────────────────────
  private async funnel(companyId: string, range: Range) {
    const where = { companyId, deletedAt: null, createdAt: { gte: range.start, lte: range.end } };
    const reached = (statuses: string[]) =>
      prisma.lead.count({ where: { ...where, status: { in: statuses as never[] } } });
    const [total, contacted, qualified, proposal, won] = await Promise.all([
      prisma.lead.count({ where }),
      reached(['CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON']),
      reached(['QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON']),
      reached(['PROPOSAL_SENT', 'NEGOTIATING', 'WON']),
      reached(['WON']),
    ]);
    const stage = (key: string, label: string, count: number) => ({
      key, label, count, rate: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    });
    return [
      stage('NEW', 'New', total), stage('CONTACTED', 'Contacted', contacted), stage('QUALIFIED', 'Qualified', qualified),
      stage('PROPOSAL', 'Proposal', proposal), stage('WON', 'Won', won),
    ];
  }

  // ── Recent conversations ───────────────────────────────────────────────────
  private async recentConversations(companyId: string) {
    const rows = await prisma.conversation.findMany({
      where: { companyId, lastMessageAt: { not: null } },
      orderBy: { lastMessageAt: 'desc' },
      take: 6,
      select: {
        id: true, status: true, aiEnabled: true, unreadCount: true, lastMessageAt: true, lastMessageText: true,
        contact: { select: { displayName: true, firstName: true, lastName: true, phoneNumber: true } },
        assignedAgent: { select: { firstName: true, lastName: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      contact: fullName(c.contact),
      lastMessage: c.lastMessageText,
      lastMessageAt: c.lastMessageAt!.toISOString(),
      status: c.status,
      aiEnabled: c.aiEnabled,
      unread: c.unreadCount,
      assignee: c.assignedAgent ? fullName(c.assignedAgent) : null,
    }));
  }

  // ── Agent activity: the AI agent and human teammates ───────────────────────
  private async agentActivity(companyId: string, range: Range) {
    const since = { gte: range.start, lte: range.end };
    const [aiMsgs, aiAgg, aiHandling, waiting, leadAi, dealAi, taskAi, humanMsgs, tasksDone, dealsWon, users, feedL, feedD, feedT] = await Promise.all([
      prisma.message.count({ where: { companyId, direction: 'OUTBOUND', isAiGenerated: true, createdAt: since } }),
      prisma.message.aggregate({
        where: { companyId, isAiGenerated: true, createdAt: since },
        _sum: { aiTokensUsed: true }, _avg: { aiLatencyMs: true },
      }),
      prisma.conversation.count({ where: { companyId, status: 'AI_HANDLING' } }),
      prisma.conversation.count({ where: { companyId, status: 'WAITING_HUMAN' } }),
      prisma.leadActivity.count({ where: { companyId, actorType: 'ai', createdAt: since } }),
      prisma.dealActivity.count({ where: { companyId, actorType: 'ai', createdAt: since } }),
      prisma.taskActivity.count({ where: { companyId, actorType: 'ai', createdAt: since } }),
      prisma.$queryRaw<Array<{ agent: string; messages: number }>>(Prisma.sql`
        SELECT c."assignedAgentId" AS agent, count(*)::int AS messages
        FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE m."companyId" = ${companyId} AND m.direction = 'OUTBOUND' AND NOT m."isAiGenerated"
          AND m."createdAt" >= ${range.start} AND m."createdAt" <= ${range.end} AND c."assignedAgentId" IS NOT NULL
        GROUP BY 1
      `),
      prisma.task.groupBy({ by: ['assignedAgentId'], where: { companyId, status: 'DONE', assignedAgentId: { not: null }, completedAt: since }, _count: true }),
      prisma.deal.groupBy({ by: ['assignedAgentId'], where: { companyId, stage: 'WON', assignedAgentId: { not: null }, wonAt: since }, _count: true, _sum: { value: true } }),
      prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true, firstName: true, lastName: true } }),
      prisma.leadActivity.findMany({ where: { companyId, actorType: 'ai', createdAt: since }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, leadId: true, title: true, createdAt: true } }),
      prisma.dealActivity.findMany({ where: { companyId, actorType: 'ai', createdAt: since }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, dealId: true, title: true, createdAt: true } }),
      prisma.taskActivity.findMany({ where: { companyId, actorType: 'ai', createdAt: since }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, taskId: true, title: true, createdAt: true } }),
    ]);

    const msgBy = new Map(humanMsgs.map((r) => [r.agent, r.messages]));
    const doneBy = new Map(tasksDone.map((r) => [r.assignedAgentId!, r._count]));
    const wonBy = new Map(dealsWon.map((r) => [r.assignedAgentId!, { count: r._count, value: r._sum.value ?? 0 }]));

    const team = users
      .map((u) => ({
        id: u.id,
        name: fullName(u),
        messages: msgBy.get(u.id) ?? 0,
        tasksDone: doneBy.get(u.id) ?? 0,
        dealsWon: wonBy.get(u.id)?.count ?? 0,
      }))
      .map((u) => ({ ...u, score: u.messages + u.tasksDone * 5 + u.dealsWon * 20 }))
      .filter((u) => u.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const recent = [
      ...feedL.map((e) => ({ id: e.id, kind: 'lead' as const, title: e.title, at: e.createdAt, href: `/leads/${e.leadId}` })),
      ...feedD.map((e) => ({ id: e.id, kind: 'deal' as const, title: e.title, at: e.createdAt, href: `/deals/${e.dealId}` })),
      ...feedT.map((e) => ({ id: e.id, kind: 'task' as const, title: e.title, at: e.createdAt, href: `/tasks/${e.taskId}` })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 6)
      .map((e) => ({ ...e, at: e.at.toISOString() }));

    return {
      ai: {
        replies: aiMsgs,
        actions: leadAi + dealAi + taskAi,
        tokens: aiAgg._sum.aiTokensUsed ?? 0,
        avgLatencyMs: aiAgg._avg.aiLatencyMs != null ? Math.round(aiAgg._avg.aiLatencyMs) : null,
        handlingNow: aiHandling,
        escalated: waiting,
      },
      team,
      recent,
    };
  }
}
