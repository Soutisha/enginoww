import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@wacrm/database';
import { QUEUES } from '@wacrm/shared';

export const WORKFORCE_AGENTS = ['LEAD_INTELLIGENCE','SALES','CUSTOMER_SUPPORT','WHATSAPP','FOLLOW_UP','PRODUCT','BRAND','ANALYTICS'] as const;
const queue = new Queue(QUEUES.MULTI_AGENT, { connection: new Redis((process.env.REDIS_URL || '').trim(), { maxRetriesPerRequest: null }) });
@Injectable()
export class AgentsService {
  list(companyId: string) { return prisma.multiAgentRun.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async get(companyId: string, id: string) { const run = await prisma.multiAgentRun.findFirst({ where: { id, companyId } }); if (!run) throw new NotFoundException('Agent run not found'); return run; }
  async create(companyId: string, userId: string, body: { title: string; objective: string; agents: string[]; sharedContext?: Record<string, unknown> }) {
    const title = body.title?.trim(); const objective = body.objective?.trim();
    const agents = [...new Set(body.agents ?? [])];
    if (!title || !objective || !agents.length || agents.some(a => !(WORKFORCE_AGENTS as readonly string[]).includes(a))) throw new BadRequestException('Provide a title, objective and one or more valid agents');
    if (objective.length > 8000 || agents.length > 8) throw new BadRequestException('Objective too long or too many agents');
    return prisma.multiAgentRun.create({ data: { companyId, createdById: userId, title, objective, agents: agents as never, sharedContext: (body.sharedContext ?? {}) as never, taskResults: [], status: 'PENDING_APPROVAL', approvalRequired: true } });
  }
  async approve(companyId: string, userId: string, id: string) {
    const run = await this.get(companyId, id);
    if (run.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only runs awaiting approval can be approved');
    const updated = await prisma.multiAgentRun.update({ where: { id }, data: { status: 'QUEUED', approvedById: userId, approvedAt: new Date() } });
    await queue.add('execute-workforce', { runId: id, companyId }, { jobId: `multi-agent-${id}`, attempts: 2, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 100, removeOnFail: 200 });
    return updated;
  }
  async reject(companyId: string, id: string) { const run = await this.get(companyId, id); if (run.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only pending runs can be rejected'); return prisma.multiAgentRun.update({ where: { id }, data: { status: 'REJECTED' } }); }
}
