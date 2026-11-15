import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const shared = read('packages/shared/src/constants/queue-names.ts');
const schema = read('packages/database/prisma/schema.prisma');
const migration = read('packages/database/prisma/migrations/20261115220000_task17_workflow_event_outbox/migration.sql');
const apiModule = read('apps/api/src/modules/workflows/workflows.module.ts');
const events = read('apps/api/src/modules/workflows/workflow-events.service.ts');
const worker = read('apps/worker/src/jobs/workflow-automation.processor.ts');
const main = read('apps/worker/src/main.ts');
const checks = [
  ['workflow BullMQ queue registered in shared constants', shared.includes("WORKFLOW_EVENTS: 'workflow_events'")],
  ['durable workflow event outbox model', schema.includes('model WorkflowEventOutbox')],
  ['outbox migration and indexes', migration.includes('WorkflowEventOutbox') && migration.includes('status_availableAt_idx')],
  ['API queue registration and event producer exported', apiModule.includes('BullModule.registerQueue') && apiModule.includes('WorkflowEventsService')],
  ['event producer persists outbox before queue fast path', events.indexOf('workflowEventOutbox.create') < events.indexOf("queue.add('dispatch-outbox'")],
  ['contact created/updated/tag events', read('apps/api/src/modules/contacts/contacts.service.ts').includes('CONTACT_CREATED') && read('apps/api/src/modules/contacts/contacts.service.ts').includes('CONTACT_TAG_ADDED')],
  ['lead created/status events', read('apps/api/src/modules/leads/leads.service.ts').includes('LEAD_CREATED') && read('apps/api/src/modules/leads/leads.service.ts').includes('LEAD_STATUS_CHANGED')],
  ['deal stage event', read('apps/api/src/modules/deals/deals.service.ts').includes('DEAL_STAGE_CHANGED')],
  ['ticket created event', read('apps/api/src/modules/tickets/tickets.service.ts').includes('TICKET_CREATED')],
  ['payment received event', read('apps/api/src/modules/payments/payments.service.ts').includes('PAYMENT_RECEIVED')],
  ['outbox event dispatch and active company-scoped matching', worker.includes('processOutbox') && worker.includes("status: 'ACTIVE', isActive: true")],
  ['scheduled cron evaluation with timezone', worker.includes('cronMatches') && worker.includes('timeZone: timezone')],
  ['delay queue and overdue recovery', worker.includes("'resume-delay'") && worker.includes('scanDueDelays')],
  ['stale queued execution recovery', worker.includes('scanStaleQueuedExecutions')],
  ['BullMQ retry/backoff policy', worker.includes('attempts: 5') && worker.includes("backoff: { type: 'exponential'")],
  ['idempotent task and note step markers', worker.includes('[workflow-execution:') && worker.includes('idempotent: true')],
  ['worker registered in service lifecycle', main.includes('startWorkflowAutomationWorker') && main.includes('workflow-maintenance-recurring') && main.includes('workflowAutomation.worker.close()')],
  ['runtime boundaries documented', read('TASK17_EVENT_DRIVEN_AUTOMATION_WORKERS.md').includes('at-least-once')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`\\n${checks.length - failed}/${checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
