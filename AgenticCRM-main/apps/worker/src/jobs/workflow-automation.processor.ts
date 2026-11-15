/**
 * Workflow event, schedule and execution processor.
 * Domain events are first persisted in WorkflowEventOutbox by the API.
 * BullMQ jobs are idempotently keyed by outbox/event and scheduled minute.
 */
import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { QUEUES } from '@wacrm/shared';
import { prisma } from '@wacrm/database';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const redisUrl = (process.env.REDIS_URL || '').trim();
const connection = () => new Redis(redisUrl, { maxRetriesPerRequest: null });
const MAX_BATCH = 200;

type JsonObject = Record<string, any>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function matchesConditions(conditions: JsonObject, payload: JsonObject): boolean {
  return Object.entries(conditions).every(([key, expected]) => {
    const actual = key.startsWith('payload.') ? payload[key.slice(8)] : payload[key];
    return String(actual ?? '') === String(expected ?? '');
  });
}

function cronFieldMatches(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  return field.split(',').some((part) => {
    const [rangePart, stepPart] = part.split('/');
    const step = Math.max(1, Number(stepPart ?? 1));
    let start = min, end = max;
    if (rangePart === '*') { start = min; end = max; }
    else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-').map(Number); start = a; end = b;
    } else { start = Number(rangePart); end = Number(rangePart); }
    return Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end && (value - start) % step === 0;
  });
}

function cronMatches(expression: string, timezone: string, now: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC', minute: 'numeric', hour: 'numeric',
      day: 'numeric', month: 'numeric', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const minute = Number(get('minute')), hour = Number(get('hour')), day = Number(get('day')), month = Number(get('month'));
    const weekday = weekdayMap[get('weekday')];
    return cronFieldMatches(fields[0], minute, 0, 59) && cronFieldMatches(fields[1], hour, 0, 23)
      && cronFieldMatches(fields[2], day, 1, 31) && cronFieldMatches(fields[3], month, 1, 12)
      && cronFieldMatches(fields[4], weekday, 0, 6);
  } catch { return false; }
}

async function processOutbox(queue: Queue, outboxId: string) {
  const row = await prisma.workflowEventOutbox.findUnique({ where: { id: outboxId } });
  if (!row || row.status === 'DISPATCHED') return;
  await prisma.workflowEventOutbox.update({ where: { id: outboxId }, data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null } });
  try {
    const workflows = await prisma.workflow.findMany({ where: { companyId: row.companyId, status: 'ACTIVE', isActive: true } });
    const payload = asObject(row.payload);
    let matched = 0;
    for (const workflow of workflows) {
      const trigger = asObject(workflow.trigger);
      if (trigger.type !== row.eventType) continue;
      if (!matchesConditions(asObject(trigger.conditions), payload)) continue;
      const executionId = `wf_${workflow.id}_${row.id}`;
      const created = await prisma.workflowExecution.createMany({
        data: [{ id: executionId, workflowId: workflow.id, companyId: workflow.companyId, contactId: row.contactId, status: 'QUEUED', steps: [] }],
        skipDuplicates: true,
      });
      if (created.count > 0) {
        await prisma.workflow.update({ where: { id: workflow.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
      }
      await queue.add('execute-workflow', {
        workflowId: workflow.id, companyId: workflow.companyId, executionId,
        startIndex: 0, payload: { ...payload, eventType: row.eventType, entityId: row.entityId, contactId: row.contactId },
      }, {
        jobId: `execute-${workflow.id}-${row.id}`,
        attempts: 5, backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 20000 },
      });
      matched++;
    }
    await prisma.workflowEventOutbox.update({ where: { id: outboxId }, data: { status: 'DISPATCHED', processedAt: new Date(), lastError: matched ? null : 'No active workflow matched this event' } });
    logger.info({ outboxId, eventType: row.eventType, matched }, 'Workflow event dispatched');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.workflowEventOutbox.update({ where: { id: outboxId }, data: { status: 'PENDING', lastError: message } }).catch(() => undefined);
    throw error;
  }
}

async function scanOutbox(queue: Queue) {
  const pending = await prisma.workflowEventOutbox.findMany({
    where: { status: { in: ['PENDING', 'PROCESSING'] }, availableAt: { lte: new Date() }, updatedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
    orderBy: { createdAt: 'asc' }, take: MAX_BATCH,
  });
  for (const row of pending) {
    await queue.add('dispatch-outbox', { outboxId: row.id }, {
      jobId: `workflow-outbox-${row.id}`,
      attempts: 5, backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 86400, count: 10000 },
    });
  }
  return pending.length;
}

async function scanScheduled(queue: Queue) {
  const now = new Date();
  const workflows = await prisma.workflow.findMany({ where: { status: 'ACTIVE', isActive: true } });
  let queued = 0;
  for (const workflow of workflows) {
    const trigger = asObject(workflow.trigger);
    if (trigger.type !== 'SCHEDULED') continue;
    if (!cronMatches(String(trigger.schedule ?? ''), String(trigger.timezone ?? 'UTC'), now)) continue;
    const minuteKey = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
    await queue.add('execute-workflow', {
      workflowId: workflow.id, companyId: workflow.companyId, executionId: `sched_${workflow.id}_${minuteKey}`, startIndex: 0,
      payload: { eventType: 'SCHEDULED', scheduledAt: now.toISOString() },
    }, {
      jobId: `scheduled-${workflow.id}-${minuteKey}`,
      attempts: 5, backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86400, count: 10000 },
    });
    queued++;
  }
  return queued;
}

async function scanStaleQueuedExecutions(queue: Queue) {
  const stale = await prisma.workflowExecution.findMany({
    where: { status: 'QUEUED', startedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
    orderBy: { startedAt: 'asc' }, take: MAX_BATCH,
  });
  for (const execution of stale) {
    const history = Array.isArray(execution.steps) ? execution.steps as JsonObject[] : [];
    const last = history[history.length - 1];
    const nextIndex = last && ['COMPLETED', 'APPROVED', 'SKIPPED'].includes(String(last.status))
      ? Number(last.stepIndex) + 1
      : last ? Number(last.stepIndex) : 0;
    await queue.add('execute-workflow', {
      workflowId: execution.workflowId, companyId: execution.companyId,
      executionId: execution.id, startIndex: nextIndex, payload: {},
    }, {
      jobId: `recover-queued-${execution.id}-${nextIndex}`,
      attempts: 5, backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86400, count: 10000 },
    });
  }
  return stale.length;
}

async function scanDueDelays(queue: Queue) {
  const rows = await prisma.workflowExecution.findMany({
    where: { status: 'WAITING_DELAY' }, take: MAX_BATCH,
    orderBy: { startedAt: 'asc' },
  });
  let queued = 0;
  for (const execution of rows) {
    const history = Array.isArray(execution.steps) ? execution.steps as JsonObject[] : [];
    const pending = history[history.length - 1];
    if (!pending || pending.status !== 'WAITING_DELAY' || new Date(String(pending.resumeAt)).getTime() > Date.now()) continue;
    await queue.add('resume-delay', { executionId: execution.id, workflowId: execution.workflowId, companyId: execution.companyId }, {
      jobId: `resume-delay-${execution.id}-${String(pending.stepIndex)}`,
      attempts: 5, backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86400, count: 10000 },
    });
    queued++;
  }
  return queued;
}

async function executeWorkflow(queue: Queue, data: JsonObject) {
  const { workflowId, companyId, startIndex = 0, payload = {} } = data;
  let execution = data.executionId
    ? await prisma.workflowExecution.findFirst({ where: { id: data.executionId, workflowId, companyId } })
    : null;
  const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, companyId, status: 'ACTIVE', isActive: true } });
  if (!workflow) {
    if (execution) await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'CANCELLED', completedAt: new Date(), error: 'Workflow is no longer active' } });
    return;
  }
  if (!execution) {
    const executionId = String(data.executionId ?? `wf_manual_${workflowId}_${Date.now()}`);
    const created = await prisma.workflowExecution.createMany({
      data: [{ id: executionId, workflowId, companyId, contactId: payload.contactId ?? null, status: 'RUNNING', steps: [] }],
      skipDuplicates: true,
    });
    execution = await prisma.workflowExecution.findFirst({ where: { id: executionId, workflowId, companyId } });
    if (created.count > 0) await prisma.workflow.update({ where: { id: workflowId }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    if (!execution) throw new Error('Could not initialize workflow execution');
  } else {
    await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'RUNNING', error: null } });
  }

  const history: JsonObject[] = Array.isArray(execution.steps) ? [...execution.steps as JsonObject[]] : [];
  const steps: JsonObject[] = Array.isArray(workflow.steps) ? workflow.steps as JsonObject[] : [];
  const contactId = execution.contactId;
  try {
    for (let index = Number(startIndex); index < steps.length; index++) {
      const step = steps[index] ?? {};
      const type = String(step.type ?? 'action');
      const config = asObject(step.config);
      const existingIndex = history.findIndex((item) => item.stepIndex === index);
      let record: JsonObject = existingIndex >= 0 ? history[existingIndex] : {
        stepIndex: index, name: String(step.name ?? `${type} ${index + 1}`), type,
        status: 'RUNNING', startedAt: new Date().toISOString(),
      };
      if (record.status === 'COMPLETED' || record.status === 'APPROVED' || record.status === 'SKIPPED') continue;
      if (existingIndex < 0) history.push(record); else history[existingIndex] = record;
      await prisma.workflowExecution.update({ where: { id: execution.id }, data: { steps: history as never } });

      if (type === 'condition') {
        const field = String(config.field ?? '');
        const actual = field.startsWith('payload.') ? payload[field.slice(8)] : payload[field];
        const expected = config.value;
        const op = String(config.operator ?? 'equals');
        const passed = op === 'not_equals' ? String(actual) !== String(expected)
          : op === 'contains' ? String(actual ?? '').includes(String(expected))
          : op === 'greater_than' ? Number(actual) > Number(expected)
          : op === 'less_than' ? Number(actual) < Number(expected)
          : String(actual ?? '') === String(expected ?? '');
        record.status = passed ? 'COMPLETED' : 'SKIPPED';
        record.result = { passed, field, operator: op };
        record.finishedAt = new Date().toISOString();
        if (!passed) {
          await prisma.workflowExecution.update({ where: { id: execution.id }, data: { steps: history as never, status: 'COMPLETED', completedAt: new Date() } });
          return;
        }
      } else if (type === 'approval') {
        record.status = 'WAITING_APPROVAL';
        record.stepIndex = index;
        record.approver = String(config.approver ?? 'admin');
        record.message = String(config.message ?? 'Approval required');
        await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'WAITING_APPROVAL', steps: history as never } });
        return;
      } else if (type === 'wait') {
        const minutes = Math.max(1, Math.min(10080, Number(config.minutes) || 1));
        record.status = 'WAITING_DELAY';
        record.resumeAt = new Date(Date.now() + minutes * 60000).toISOString();
        record.finishedAt = new Date().toISOString();
        await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'WAITING_DELAY', steps: history as never } });
        await queue.add('resume-delay', { executionId: execution.id, workflowId, companyId }, {
          delay: minutes * 60000, jobId: `resume-delay-${execution.id}-${index}`,
          attempts: 5, backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { age: 86400, count: 10000 },
        });
        return;
      } else if (type === 'action') {
        const action = String(config.action ?? '');
        if (action === 'add_tag' || action === 'remove_tag') {
          if (!contactId) throw new Error(`${action} requires a contact context`);
          const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId, deletedAt: null } });
          if (!contact) throw new Error('Workflow contact no longer exists');
          const tag = String(config.tagName ?? '').trim();
          if (!tag) throw new Error('Tag name is required');
          const tags = action === 'add_tag' ? Array.from(new Set([...contact.tags, tag])) : contact.tags.filter((item: string) => item !== tag);
          await prisma.contact.update({ where: { id: contactId }, data: { tags } });
          record.result = { action, tag, tags };
        } else if (action === 'create_task') {
          const title = String(config.title ?? config.tagName ?? 'Workflow task').trim();
          const marker = `[workflow-execution:${execution.id}:step:${index}]`;
          const already = await prisma.task.findFirst({ where: { companyId, title, description: { contains: marker } }, select: { id: true } });
          const task = already ?? await prisma.task.create({ data: { companyId, contactId: contactId ?? null, title, description: `${String(config.description ?? `Created by workflow: ${workflow.name}`)}\n${marker}`, source: 'MANUAL' } });
          record.result = { taskId: task.id, title, idempotent: Boolean(already) };
        } else if (action === 'create_note') {
          if (!contactId) throw new Error('Create note requires a contact context');
          const note = String(config.message ?? config.note ?? '').trim();
          if (!note) throw new Error('Note content is required');
          const marker = `[workflow-execution:${execution.id}:step:${index}]`;
          const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId, deletedAt: null }, select: { notes: true } });
          if (!contact) throw new Error('Workflow contact no longer exists');
          if (!(contact.notes ?? '').includes(marker)) await prisma.contact.update({ where: { id: contactId }, data: { notes: [contact.notes, `${note} ${marker}`].filter(Boolean).join('\n') } });
          record.result = { noteAdded: true, idempotent: true };
        } else {
          throw new Error(`Action "${action}" is not enabled in the worker runtime`);
        }
        record.status = 'COMPLETED';
      } else if (type === 'ai_agent') {
        throw new Error('AI agent step requires an explicitly configured agent runtime');
      } else {
        throw new Error(`Unsupported workflow node type "${type}"`);
      }
      record.finishedAt = new Date().toISOString();
      await prisma.workflowExecution.update({ where: { id: execution.id }, data: { steps: history as never } });
    }
    await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'COMPLETED', steps: history as never, completedAt: new Date(), error: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const last = history[history.length - 1];
    if (last && last.status === 'RUNNING') { last.status = 'FAILED'; last.error = message; last.finishedAt = new Date().toISOString(); }
    await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', steps: history as never, error: message, completedAt: new Date() } });
    await prisma.workflow.update({ where: { id: workflowId }, data: { errorCount: { increment: 1 }, lastError: message } });
    await prisma.workflowActivity.create({ data: { workflowId, companyId, type: 'FAILED', actorType: 'system', title: `Execution ${execution.id} failed`, body: message } }).catch(() => undefined);
    throw error;
  }
}

async function resumeDelay(queue: Queue, data: JsonObject) {
  const execution = await prisma.workflowExecution.findFirst({ where: { id: data.executionId, workflowId: data.workflowId, companyId: data.companyId } });
  if (!execution) return;
  const history: JsonObject[] = Array.isArray(execution.steps) ? [...execution.steps as JsonObject[]] : [];
  const pending = history[history.length - 1];
  if (execution.status === 'QUEUED' && pending?.status === 'COMPLETED') {
    await queue.add('execute-workflow', { ...data, executionId: execution.id, startIndex: Number(pending.stepIndex) + 1, payload: {} }, {
      jobId: `continue-${execution.id}-${pending.stepIndex}`, attempts: 5, backoff: { type: 'exponential', delay: 3000 },
    });
    return;
  }
  if (execution.status !== 'WAITING_DELAY' || !pending || pending.status !== 'WAITING_DELAY') return;
  if (new Date(String(pending.resumeAt)).getTime() > Date.now()) {
    await queue.add('resume-delay', data, { delay: new Date(String(pending.resumeAt)).getTime() - Date.now(), jobId: `resume-delay-${execution.id}-${pending.stepIndex}` });
    return;
  }
  pending.status = 'COMPLETED';
  pending.resumedAt = new Date().toISOString();
  await prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'QUEUED', steps: history as never } });
  await queue.add('execute-workflow', { ...data, executionId: execution.id, startIndex: Number(pending.stepIndex) + 1, payload: {} }, {
    jobId: `continue-${execution.id}-${pending.stepIndex}`,
    attempts: 5, backoff: { type: 'exponential', delay: 3000 },
  });
}

export function startWorkflowAutomationWorker() {
  const workerConnection = connection();
  const queue = new Queue(QUEUES.WORKFLOW_EVENTS, { connection: connection() });
  const worker = new Worker(QUEUES.WORKFLOW_EVENTS, async (job: Job) => {
    switch (job.name) {
      case 'dispatch-outbox': return processOutbox(queue, String(job.data.outboxId));
      case 'execute-workflow': return executeWorkflow(queue, job.data as JsonObject);
      case 'resume-delay': return resumeDelay(queue, job.data as JsonObject);
      case 'maintenance-scan': {
        const [outbox, scheduled, delays, queued] = await Promise.all([scanOutbox(queue), scanScheduled(queue), scanDueDelays(queue), scanStaleQueuedExecutions(queue)]);
        logger.info({ outbox, scheduled, delays, queued }, 'Workflow maintenance scan complete');
        return { outbox, scheduled, delays, queued };
      }
      default: throw new Error(`Unknown workflow queue job: ${job.name}`);
    }
  }, { connection: workerConnection, concurrency: 5 });

  worker.on('failed', (job, error) => logger.error({ jobId: job?.id, jobName: job?.name, error: error.message }, 'Workflow job failed'));
  return { worker, queue };
}
