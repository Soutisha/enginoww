# Task 17 — Event-Driven Automation and Background Workers

## Delivered

- Added a durable `WorkflowEventOutbox` table. CRM writes record events in the database before attempting the Redis fast path.
- Added the `workflow_events` BullMQ queue and a worker processor for event dispatch, workflow execution, delay resumption, and maintenance scans.
- Added event producers for:
  - `CONTACT_CREATED`
  - `CONTACT_UPDATED`
  - `CONTACT_TAG_ADDED`
  - `LEAD_CREATED`
  - `LEAD_STATUS_CHANGED`
  - `DEAL_STAGE_CHANGED`
  - `TICKET_CREATED`
  - `PAYMENT_RECEIVED`
- Active workflows are matched by company and trigger type. Optional trigger conditions compare exact values against event payload fields.
- Added a per-minute scheduler scan for active `SCHEDULED` workflows. Five-field cron expressions support numeric values, `*`, lists, ranges and steps, evaluated in the configured IANA timezone.
- Delay nodes now schedule a delayed BullMQ resume job. A recovery scan also finds overdue `WAITING_DELAY` executions if a worker was offline.
- Outbox recovery scans pending or stale processing records and retries queue dispatch. Stale queued executions are also re-enqueued after five minutes.
- Queue jobs use deterministic IDs, exponential backoff, bounded retention and worker concurrency.
- Supported worker actions include add/remove contact tag, create CRM task, create contact note, payload conditions, approval checkpoints and wait/delay.
- Task creation and contact-note writes include execution-step markers so a retried step can detect an already-applied side effect. Tag updates are naturally idempotent.
- Worker starts and shuts down with the existing worker service lifecycle.

## Architecture

1. API service commits the CRM record.
2. The event producer writes `WorkflowEventOutbox` immediately after the domain write.
3. The producer attempts to enqueue the outbox row immediately.
4. The worker resolves matching active workflows and creates execution records.
5. Execution jobs run on BullMQ with persisted step history.
6. A periodic maintenance job recovers outbox rows, checks scheduled triggers, and finds overdue delays.

## Database migration

`packages/database/prisma/migrations/20261115220000_task17_workflow_event_outbox/migration.sql`

Run the normal database migration and Prisma client generation before building/running API and worker services.

## Operational configuration

- API and worker must share the same `REDIS_URL`.
- Redis must be reachable by both services.
- The API must run the new migration and regenerate Prisma Client.
- The worker service must be running for event and scheduled workflows to execute.
- Scheduled triggers are checked once per minute.
- The outbox scanner retries stale records after five minutes; the direct queue path normally dispatches immediately.

## Boundaries and safety

- Manual `/workflows/:id/run` still uses the Task 16 synchronous execution path. Event- and schedule-triggered runs use BullMQ.
- Event producers currently cover the listed CRM service write paths, not every possible direct database write or third-party webhook.
- Trigger conditions are exact-match comparisons against event payload keys; complex expression trees are not implemented.
- Cron supports five numeric fields, `*`, comma lists, ranges and `/step`. Named months/weekdays, seconds, `?`, `L`, `W`, and `#` are not supported.
- AI-agent, outbound WhatsApp, email, generic webhook and other unsupported actions fail closed; no external message is sent by this task.
- The outbox insert currently follows the CRM write rather than sharing its database transaction, so a process crash in that narrow gap can lose the event. A fully transactional outbox should be used when every event must be guaranteed. Queue delivery after outbox creation is at-least-once. Supported write actions use step markers/idempotent updates, but external side effects should not be added without their own idempotency strategy.
- The worker has bounded retries and exponential backoff. A permanently invalid workflow can still exhaust retries and appear FAILED; fix its configuration before retrying.
- Approval decisions remain protected by the API's existing JWT, company-scope and workflow permission guards. Fine-grained approver-role authorization remains a hardening item.

## Verification

Run `pnpm verify:task17`. Static checks do not replace Prisma migration, Redis-backed integration tests, or a multi-process production soak test.
