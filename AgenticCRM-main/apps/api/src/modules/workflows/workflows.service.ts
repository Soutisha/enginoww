import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, WorkflowStatus, WorkflowActivityType } from '@wacrm/database';
import type {
  WorkflowActor, CreateWorkflowDto, UpdateWorkflowDto,
  ListWorkflowsFilters, WorkflowStatsSnapshot, BulkMutationResult,
} from './workflow.types';

@Injectable()
export class WorkflowsService {

  // ── Read ───────────────────────────────────────────────────────────────────

  async list(companyId: string, filters: ListWorkflowsFilters = {}) {
    const { page = 1, limit = 20, sort = 'recent', search, status, tags, triggerType } = filters;

    const where: Record<string, unknown> = { companyId };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tags?.length) {
      where.tags = { hasSome: tags };
    }
    if (triggerType) {
      where.trigger = { path: ['type'], equals: triggerType };
    }

    const orderBy = sort === 'name' ? { name: 'asc' as const }
      : sort === 'runs' ? { runCount: 'desc' as const }
      : sort === 'errors' ? { errorCount: 'desc' as const }
      : { createdAt: 'desc' as const };

    const [total, items] = await Promise.all([
      prisma.workflow.count({ where: where as never }),
      prisma.workflow.findMany({
        where: where as never,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { executions: true } } },
      }),
    ]);

    return { total, page, limit, items };
  }

  async get(companyId: string, id: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id, companyId },
      include: { _count: { select: { executions: true } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async getTimeline(companyId: string, workflowId: string) {
    await this.get(companyId, workflowId);
    return prisma.workflowActivity.findMany({
      where: { workflowId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getExecutions(companyId: string, workflowId: string, limit = 20) {
    await this.get(companyId, workflowId);
    return prisma.workflowExecution.findMany({
      where: { workflowId, companyId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  // kept for backward compat
  async listExecutions(companyId: string, workflowId: string) {
    return this.getExecutions(companyId, workflowId);
  }

  async stats(companyId: string): Promise<WorkflowStatsSnapshot> {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [byStatus, runsLast7d, failuresLast7d] = await Promise.all([
      prisma.workflow.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
      }),
      prisma.workflowExecution.count({
        where: { companyId, startedAt: { gte: since7d } },
      }),
      prisma.workflowExecution.count({
        where: { companyId, status: 'FAILED', startedAt: { gte: since7d } },
      }),
    ]);

    const countByStatus = Object.fromEntries(byStatus.map(r => [r.status, r._count]));

    return {
      total: byStatus.reduce((s, r) => s + r._count, 0),
      active: countByStatus['ACTIVE'] ?? 0,
      paused: countByStatus['PAUSED'] ?? 0,
      draft: countByStatus['DRAFT'] ?? 0,
      archived: countByStatus['ARCHIVED'] ?? 0,
      runsLast7d,
      failuresLast7d,
    };
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async create(companyId: string, dto: CreateWorkflowDto, actor: WorkflowActor) {
    const existing = await prisma.workflow.findFirst({ where: { companyId, name: dto.name } });
    if (existing) throw new BadRequestException(`A workflow named "${dto.name}" already exists`);

    const workflow = await prisma.workflow.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        trigger: (dto.trigger ?? {}) as never,
        steps: (dto.steps ?? []) as never,
        tags: dto.tags ?? [],
        status: 'DRAFT',
        isActive: false,
        createdByUserId: actor.id,
      },
    });

    await this.logActivity(workflow.id, companyId, 'CREATED', actor, `Workflow "${workflow.name}" created`);
    return workflow;
  }

  async update(companyId: string, id: string, dto: UpdateWorkflowDto, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.trigger && { trigger: dto.trigger as never }),
        ...(dto.steps && { steps: dto.steps as never }),
        ...(dto.tags && { tags: dto.tags }),
      },
    });

    await this.logActivity(id, companyId, 'UPDATED', actor, `Workflow "${workflow.name}" updated`);
    return updated;
  }

  async activate(companyId: string, id: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);
    if (workflow.status === 'ACTIVE') throw new BadRequestException('Workflow is already active');
    if (workflow.status === 'ARCHIVED') throw new BadRequestException('Restore the workflow before activating');

    const updated = await prisma.workflow.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true, publishedAt: workflow.publishedAt ?? new Date() },
    });

    await this.logActivity(id, companyId, 'ACTIVATED', actor, `Workflow "${workflow.name}" activated`);
    return updated;
  }

  async pause(companyId: string, id: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);
    if (workflow.status !== 'ACTIVE') throw new BadRequestException('Only ACTIVE workflows can be paused');

    const updated = await prisma.workflow.update({
      where: { id },
      data: { status: 'PAUSED', isActive: false },
    });

    await this.logActivity(id, companyId, 'PAUSED', actor, `Workflow "${workflow.name}" paused`);
    return updated;
  }

  async archive(companyId: string, id: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);

    await prisma.workflow.update({
      where: { id },
      data: { status: 'ARCHIVED', isActive: false },
    });

    await this.logActivity(id, companyId, 'ARCHIVED', actor, `Workflow "${workflow.name}" archived`);
    return { ok: true };
  }

  async restore(companyId: string, id: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);
    if (workflow.status !== 'ARCHIVED') throw new BadRequestException('Only ARCHIVED workflows can be restored');

    const updated = await prisma.workflow.update({
      where: { id },
      data: { status: 'DRAFT', isActive: false },
    });

    await this.logActivity(id, companyId, 'RESTORED', actor, `Workflow "${workflow.name}" restored to DRAFT`);
    return updated;
  }

  async duplicate(companyId: string, id: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);

    const copy = await prisma.workflow.create({
      data: {
        companyId,
        name: `${workflow.name} (copy)`,
        description: workflow.description,
        trigger: workflow.trigger as never,
        steps: workflow.steps as never,
        tags: workflow.tags,
        status: 'DRAFT',
        isActive: false,
        createdByUserId: actor.id,
      },
    });

    await this.logActivity(copy.id, companyId, 'CREATED', actor, `Duplicated from "${workflow.name}"`);
    return copy;
  }

  async addNote(companyId: string, id: string, note: string, actor: WorkflowActor) {
    await this.get(companyId, id);
    await this.logActivity(id, companyId, 'NOTE_ADDED', actor, note);
    return { ok: true };
  }

  async run(companyId: string, id: string, actor: WorkflowActor, input: { contactId?: string; payload?: Record<string, unknown> } = {}) {
    const workflow = await this.get(companyId, id);
    if (workflow.status !== 'ACTIVE') throw new BadRequestException('Activate the workflow before running it');
    const contactId = input.contactId;
    if (contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId, deletedAt: null }, select: { id: true } });
      if (!contact) throw new BadRequestException('Contact was not found in this company');
    }
    const execution = await prisma.workflowExecution.create({
      data: { workflowId: id, companyId, contactId: contactId ?? null, status: 'RUNNING', steps: [] },
    });
    await prisma.workflow.update({ where: { id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    await this.logActivity(id, companyId, 'EXECUTED', actor, `Execution ${execution.id} started`);
    return this.executeFromStep(companyId, workflow, execution.id, 0, input.payload ?? {});
  }

  async resumeApproval(companyId: string, workflowId: string, executionId: string, decision: 'APPROVE' | 'REJECT', actor: WorkflowActor) {
    if (decision !== 'APPROVE' && decision !== 'REJECT') throw new BadRequestException('Decision must be APPROVE or REJECT');
    const workflow = await this.get(companyId, workflowId);
    const execution = await prisma.workflowExecution.findFirst({ where: { id: executionId, workflowId, companyId } });
    if (!execution) throw new NotFoundException('Workflow execution not found');
    if (execution.status !== 'WAITING_APPROVAL') throw new BadRequestException('Execution is not waiting for approval');
    const history = Array.isArray(execution.steps) ? execution.steps as Array<Record<string, unknown>> : [];
    const pending = history[history.length - 1];
    if (!pending || pending.status !== 'WAITING_APPROVAL') throw new BadRequestException('Approval checkpoint is missing');
    const approved = decision === 'APPROVE';
    history[history.length - 1] = { ...pending, status: approved ? 'APPROVED' : 'REJECTED', decidedAt: new Date().toISOString(), decidedBy: actor.id };
    await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: approved ? 'RUNNING' : 'REJECTED', steps: history as never, ...(approved ? {} : { completedAt: new Date() }) } });
    await this.logActivity(workflowId, companyId, 'NOTE_ADDED', actor, `Execution ${executionId} approval ${decision.toLowerCase()}`);
    if (!approved) return prisma.workflowExecution.findUnique({ where: { id: executionId } });
    const nextIndex = Number(pending.stepIndex) + 1;
    return this.executeFromStep(companyId, workflow, executionId, nextIndex, {});
  }

  async resumeDelay(companyId: string, workflowId: string, executionId: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, workflowId);
    const execution = await prisma.workflowExecution.findFirst({ where: { id: executionId, workflowId, companyId } });
    if (!execution) throw new NotFoundException('Workflow execution not found');
    if (execution.status !== 'WAITING_DELAY') throw new BadRequestException('Execution is not waiting for a delay');
    const history = Array.isArray(execution.steps) ? execution.steps as Array<Record<string, unknown>> : [];
    const pending = history[history.length - 1];
    if (!pending || pending.status !== 'WAITING_DELAY') throw new BadRequestException('Delay checkpoint is missing');
    if (new Date(String(pending.resumeAt)).getTime() > Date.now()) throw new BadRequestException('The configured delay has not elapsed yet');
    history[history.length - 1] = { ...pending, status: 'COMPLETED', resumedAt: new Date().toISOString() };
    await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'RUNNING', steps: history as never } });
    await this.logActivity(workflowId, companyId, 'NOTE_ADDED', actor, `Execution ${executionId} delay completed`);
    return this.executeFromStep(companyId, workflow, executionId, Number(pending.stepIndex) + 1, {});
  }

  private async executeFromStep(companyId: string, workflow: any, executionId: string, startIndex: number, payload: Record<string, unknown>) {
    const execution = await prisma.workflowExecution.findFirst({ where: { id: executionId, companyId } });
    if (!execution) throw new NotFoundException('Workflow execution not found');
    const history: Array<Record<string, unknown>> = Array.isArray(execution.steps) ? [...execution.steps as Array<Record<string, unknown>>] : [];
    const steps = Array.isArray(workflow.steps) ? workflow.steps as Array<Record<string, any>> : [];
    const contactId = execution.contactId as string | null;

    try {
      for (let index = startIndex; index < steps.length; index += 1) {
        const step = steps[index] ?? {};
        const type = String(step.type ?? 'action');
        const config = (step.config && typeof step.config === 'object' ? step.config : {}) as Record<string, any>;
        const record: Record<string, unknown> = { stepIndex: index, name: String(step.name ?? `${type} ${index + 1}`), type, status: 'RUNNING', startedAt: new Date().toISOString() };
        history.push(record);
        await prisma.workflowExecution.update({ where: { id: executionId }, data: { steps: history as never } });

        if (type === 'condition') {
          const field = String(config.field ?? '');
          const actual = field.startsWith('payload.') ? payload[field.slice(8)] : payload[field];
          const expected = config.value;
          const operator = String(config.operator ?? 'equals');
          const passed = operator === 'not_equals' ? String(actual) !== String(expected)
            : operator === 'contains' ? String(actual ?? '').includes(String(expected))
            : operator === 'greater_than' ? Number(actual) > Number(expected)
            : operator === 'less_than' ? Number(actual) < Number(expected)
            : String(actual ?? '') === String(expected ?? '');
          record.status = passed ? 'COMPLETED' : 'SKIPPED';
          record.result = { passed, field, operator };
          if (!passed) { record.finishedAt = new Date().toISOString(); break; }
        } else if (type === 'approval') {
          record.status = 'WAITING_APPROVAL';
          record.stepIndex = index;
          record.message = String(config.message ?? 'Approval required');
          record.approver = String(config.approver ?? 'admin');
          record.finishedAt = new Date().toISOString();
          await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'WAITING_APPROVAL', steps: history as never } });
          return prisma.workflowExecution.findUnique({ where: { id: executionId } });
        } else if (type === 'wait') {
          const minutes = Math.max(1, Math.min(10080, Number(config.minutes) || 1));
          record.status = 'WAITING_DELAY';
          record.resumeAt = new Date(Date.now() + minutes * 60000).toISOString();
          record.finishedAt = new Date().toISOString();
          await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'WAITING_DELAY', steps: history as never } });
          return prisma.workflowExecution.findUnique({ where: { id: executionId } });
        } else if (type === 'ai_agent') {
          record.status = 'BLOCKED';
          record.result = 'AI agent execution requires a configured, permission-scoped agent runtime; no external action was attempted.';
          throw new BadRequestException('AI agent step requires an enabled agent runtime');
        } else if (type === 'action') {
          const action = String(config.action ?? '');
          if (action === 'add_tag' || action === 'remove_tag') {
            if (!contactId) throw new BadRequestException(`${action} requires a contact context`);
            const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId, deletedAt: null } });
            if (!contact) throw new BadRequestException('Execution contact no longer exists');
            const tag = String(config.tagName ?? '').trim();
            if (!tag) throw new BadRequestException('Tag name is required');
            const tags = action === 'add_tag' ? Array.from(new Set([...contact.tags, tag])) : contact.tags.filter((item: string) => item !== tag);
            await prisma.contact.update({ where: { id: contactId }, data: { tags } });
            record.result = { action, tag, tags };
          } else if (action === 'create_task') {
            const title = String(config.title ?? config.tagName ?? 'Workflow task').trim();
            if (!title) throw new BadRequestException('Task title is required');
            const task = await prisma.task.create({ data: { companyId, contactId: contactId ?? null, title, description: String(config.description ?? `Created by workflow: ${workflow.name}`), source: 'MANUAL' } });
            record.result = { taskId: task.id, title };
          } else if (action === 'create_note') {
            if (!contactId) throw new BadRequestException('Create note requires a contact context');
            const note = String(config.message ?? config.note ?? '').trim();
            if (!note) throw new BadRequestException('Note content is required');
            const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId, deletedAt: null }, select: { notes: true } });
            if (!contact) throw new BadRequestException('Execution contact no longer exists');
            await prisma.contact.update({ where: { id: contactId }, data: { notes: [contact.notes, note].filter(Boolean).join('\n') } });
            record.result = { noteAdded: true };
          } else {
            throw new BadRequestException(`Action "${action}" is not enabled in the workflow runtime`);
          }
          record.status = 'COMPLETED';
        } else {
          throw new BadRequestException(`Unsupported workflow node type "${type}"`);
        }
        record.finishedAt = new Date().toISOString();
        await prisma.workflowExecution.update({ where: { id: executionId }, data: { steps: history as never } });
      }
      await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'COMPLETED', steps: history as never, completedAt: new Date() } });
      return prisma.workflowExecution.findUnique({ where: { id: executionId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workflow execution failed';
      const last = history[history.length - 1];
      if (last && last.status === 'RUNNING') { last.status = 'FAILED'; last.error = message; last.finishedAt = new Date().toISOString(); }
      await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'FAILED', steps: history as never, error: message, completedAt: new Date() } });
      await prisma.workflow.update({ where: { id: workflow.id }, data: { errorCount: { increment: 1 }, lastError: message } });
      await prisma.workflowActivity.create({ data: { workflowId: workflow.id, companyId, type: 'FAILED', actorType: 'system', title: `Execution ${executionId} failed`, body: message } });
      return prisma.workflowExecution.findUnique({ where: { id: executionId } });
    }
  }

  async remove(companyId: string, id: string, actor: WorkflowActor) {
    const workflow = await this.get(companyId, id);
    await prisma.workflow.delete({ where: { id } });
    await this.logActivity(id, companyId, 'ARCHIVED', actor, `Workflow "${workflow.name}" deleted`).catch(() => {});
    return { ok: true };
  }

  // ── Bulk ───────────────────────────────────────────────────────────────────

  async bulkActivate(companyId: string, ids: string[], actor: WorkflowActor): Promise<BulkMutationResult> {
    return this._bulkStatus(companyId, ids, 'ACTIVE', true, 'ACTIVATED', actor);
  }

  async bulkPause(companyId: string, ids: string[], actor: WorkflowActor): Promise<BulkMutationResult> {
    return this._bulkStatus(companyId, ids, 'PAUSED', false, 'PAUSED', actor);
  }

  async bulkArchive(companyId: string, ids: string[], actor: WorkflowActor): Promise<BulkMutationResult> {
    return this._bulkStatus(companyId, ids, 'ARCHIVED', false, 'ARCHIVED', actor);
  }

  async bulkDelete(companyId: string, ids: string[], actor: WorkflowActor): Promise<BulkMutationResult> {
    const result = await prisma.workflow.deleteMany({ where: { companyId, id: { in: ids } } });
    for (const id of ids) {
      await this.logActivity(id, companyId, 'ARCHIVED', actor, 'Bulk deleted').catch(() => {});
    }
    return { updated: result.count, failed: ids.length - result.count };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _bulkStatus(
    companyId: string, ids: string[], status: WorkflowStatus, isActive: boolean,
    activityType: WorkflowActivityType, actor: WorkflowActor,
  ): Promise<BulkMutationResult> {
    const result = await prisma.workflow.updateMany({
      where: { companyId, id: { in: ids } },
      data: { status, isActive },
    });
    for (const id of ids) {
      await this.logActivity(id, companyId, activityType, actor, `Bulk ${status.toLowerCase()}`).catch(() => {});
    }
    return { updated: result.count, failed: ids.length - result.count };
  }

  private async logActivity(
    workflowId: string, companyId: string, type: WorkflowActivityType,
    actor: WorkflowActor, title: string, meta?: Record<string, unknown>,
  ) {
    return prisma.workflowActivity.create({
      data: {
        workflowId,
        companyId,
        type,
        actorType: actor.type,
        actorId: actor.id,
        title,
        meta: meta as never,
      },
    });
  }
}
