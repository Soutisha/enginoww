import { Injectable } from '@nestjs/common';
import { prisma } from '@wacrm/database';

/** Company-scoped, compact data contract for the 3D business command centre. */
@Injectable()
export class CommandCentreService {
  async getSnapshot(companyId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [contacts, leads, deals, products, agents, conversations, aiMessages, executions, lineItems, totals] = await Promise.all([
      prisma.contact.findMany({
        where: { companyId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 14,
        select: { id: true, displayName: true, firstName: true, lastName: true, lifecycleStage: true, score: true, updatedAt: true },
      }),
      prisma.lead.findMany({
        where: { companyId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 16,
        select: { id: true, title: true, status: true, score: true, estimatedValue: true, currency: true, contactId: true, updatedAt: true },
      }),
      prisma.deal.findMany({
        where: { companyId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 14,
        select: { id: true, title: true, stage: true, value: true, currency: true, probability: true, contactId: true, leadId: true, updatedAt: true },
      }),
      prisma.product.findMany({
        where: { companyId, archivedAt: null }, orderBy: { updatedAt: 'desc' }, take: 12,
        select: { id: true, name: true, category: true, price: true, currency: true, stock: true, totalSold: true, isActive: true, trackInventory: true },
      }),
      prisma.user.findMany({
        where: { companyId, isActive: true }, orderBy: { lastLoginAt: 'desc' }, take: 8,
        select: { id: true, firstName: true, lastName: true, role: true, lastLoginAt: true },
      }),
      prisma.conversation.findMany({
        where: { companyId }, orderBy: { lastMessageAt: 'desc' }, take: 10,
        select: { id: true, status: true, aiEnabled: true, unreadCount: true, lastMessageAt: true, lastMessageText: true, contact: { select: { id: true, displayName: true, firstName: true, lastName: true } }, assignedAgent: { select: { firstName: true, lastName: true } } },
      }),
      prisma.message.findMany({
        where: { companyId, isAiGenerated: true, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 8,
        select: { id: true, aiProvider: true, aiModel: true, aiLatencyMs: true, createdAt: true, conversation: { select: { contact: { select: { displayName: true, firstName: true, lastName: true } } } } },
      }),
      prisma.workflowExecution.findMany({
        where: { companyId, startedAt: { gte: since } }, orderBy: { startedAt: 'desc' }, take: 8,
        select: { id: true, status: true, startedAt: true, completedAt: true, workflow: { select: { name: true } } },
      }),
      prisma.dealLineItem.findMany({
        where: { companyId, productId: { not: null } }, orderBy: { updatedAt: 'desc' }, take: 120,
        select: { dealId: true, productId: true },
      }),
      Promise.all([
        prisma.contact.count({ where: { companyId, deletedAt: null } }),
        prisma.lead.count({ where: { companyId, deletedAt: null } }),
        prisma.deal.count({ where: { companyId, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } } }),
        prisma.product.count({ where: { companyId, archivedAt: null, isActive: true } }),
        prisma.conversation.count({ where: { companyId, status: 'WAITING_HUMAN' } }),
        prisma.message.count({ where: { companyId, isAiGenerated: true, createdAt: { gte: since } } }),
      ]),
    ]);

    const [contactCount, leadCount, openDealCount, activeProductCount, waitingHumanCount, aiReplyCount] = totals;
    const label = (person: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null) =>
      person ? ([person.firstName, person.lastName].filter(Boolean).join(' ') || person.displayName || 'Unnamed contact') : 'Unknown contact';

    const nodes = [
      ...contacts.map((item) => ({ id: `contact:${item.id}`, entityId: item.id, kind: 'contact', label: label(item), detail: item.lifecycleStage, score: item.score, updatedAt: item.updatedAt.toISOString() })),
      ...leads.map((item) => ({ id: `lead:${item.id}`, entityId: item.id, kind: 'lead', label: item.title, detail: item.status, score: item.score, value: item.estimatedValue, currency: item.currency, contactId: item.contactId, updatedAt: item.updatedAt.toISOString() })),
      ...deals.map((item) => ({ id: `deal:${item.id}`, entityId: item.id, kind: 'deal', label: item.title, detail: item.stage, value: item.value, currency: item.currency, probability: item.probability, contactId: item.contactId, leadId: item.leadId, updatedAt: item.updatedAt.toISOString() })),
      ...products.map((item) => ({ id: `product:${item.id}`, entityId: item.id, kind: 'product', label: item.name, detail: item.category || (item.isActive ? 'Active product' : 'Inactive product'), value: item.price / 100, currency: item.currency, stock: item.trackInventory ? item.stock : null, totalSold: item.totalSold })),
      ...agents.map((item) => ({ id: `agent:${item.id}`, entityId: item.id, kind: 'agent', label: `${item.firstName} ${item.lastName}`, detail: item.role, updatedAt: item.lastLoginAt?.toISOString() ?? null })),
    ];

    const links = [
      ...leads.map((item) => ({ source: `contact:${item.contactId}`, target: `lead:${item.id}`, kind: 'contact-lead' })),
      ...deals.flatMap((item) => [
        { source: `contact:${item.contactId}`, target: `deal:${item.id}`, kind: 'contact-deal' },
        ...(item.leadId ? [{ source: `lead:${item.leadId}`, target: `deal:${item.id}`, kind: 'lead-deal' }] : []),
      ]),
      ...lineItems.filter((item) => item.productId).map((item) => ({ source: `product:${item.productId}`, target: `deal:${item.dealId}`, kind: 'product-deal' })),
    ];

    const activity = [
      ...conversations.map((item) => ({ id: `conversation:${item.id}`, kind: 'conversation', title: `Conversation · ${label(item.contact)}`, detail: item.lastMessageText || item.status, at: item.lastMessageAt?.toISOString() ?? null, entityId: item.id, status: item.status, aiEnabled: item.aiEnabled, unreadCount: item.unreadCount, assignedTo: item.assignedAgent ? `${item.assignedAgent.firstName} ${item.assignedAgent.lastName}` : null })),
      ...aiMessages.map((item) => ({ id: `ai:${item.id}`, kind: 'ai', title: `AI reply · ${label(item.conversation.contact)}`, detail: [item.aiProvider, item.aiModel].filter(Boolean).join(' / ') || 'AI response', at: item.createdAt.toISOString(), entityId: item.id, latencyMs: item.aiLatencyMs })),
      ...executions.map((item) => ({ id: `workflow:${item.id}`, kind: 'workflow', title: `Workflow · ${item.workflow.name}`, detail: item.status, at: item.startedAt.toISOString(), entityId: item.id, status: item.status })),
    ].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 18);

    return {
      generatedAt: new Date().toISOString(),
      stats: { contacts: contactCount, leads: leadCount, openDeals: openDealCount, activeProducts: activeProductCount, waitingHuman: waitingHumanCount, aiReplies24h: aiReplyCount },
      nodes, links, activity,
      agents: agents.map((item) => ({ id: item.id, name: `${item.firstName} ${item.lastName}`, role: item.role, lastLoginAt: item.lastLoginAt?.toISOString() ?? null })),
    };
  }
}
