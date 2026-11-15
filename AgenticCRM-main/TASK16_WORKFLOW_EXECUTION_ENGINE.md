# Task 16 — Workflow Execution Engine

## Delivered

- Manual execution now runs saved workflow steps instead of creating a placeholder RUNNING row.
- Execution history is updated after each step and captures timestamps, results, skips, waits, approval checkpoints, and errors.
- Company-scoped optional contact context is validated before execution.
- Condition nodes support `equals`, `not_equals`, `contains`, `greater_than`, and `less_than` against the supplied execution payload.
- Action handlers: add/remove contact tag, create CRM task, and append a contact note.
- Human approval pauses the execution. The detail page exposes approve/reject controls and the API resumes or rejects the execution.
- Wait nodes create a persisted `resumeAt` checkpoint; an authenticated resume endpoint continues only after that time.
- Failures are persisted, workflow error counters and last error are updated, and an activity entry is written.
- Unsupported actions and AI-agent nodes fail closed rather than pretending an external operation occurred.
- All reads and mutations are scoped to the authenticated company.

## API

- `POST /workflows/:id/run` — optional `{ contactId, payload }`
- `POST /workflows/:id/executions/:executionId/approval` — `{ decision: "APPROVE" | "REJECT" }`
- `POST /workflows/:id/executions/:executionId/resume-delay` — resumes an elapsed delay checkpoint
- Existing `GET /workflows/:id/executions` returns the persisted execution records.

## Runtime boundaries

- Task 17 adds BullMQ delayed jobs and a recovery scanner for overdue delay checkpoints on event/schedule-triggered executions. The Task 16 synchronous manual-run path still exposes the authenticated resume endpoint.
- Task 17 adds CRM event dispatch and scheduled-trigger scanning for the event/schedule worker path.
- AI-agent, WhatsApp-send, webhook, lead-status update, and other unimplemented actions are deliberately not executed.
- Conditions currently evaluate the explicit execution payload; they do not implicitly fetch arbitrary CRM fields.
- Execution is synchronous in the API request. Production deployment should move long-running workflows to a durable queue with idempotency, leases, retry policy, and concurrency limits.
- Approval routes are protected by the existing authentication, company-scope, and workflow permission guards; finer-grained approver-role enforcement is a follow-up hardening item.

## Verification

Run `pnpm verify:task16`. Static checks do not replace database-backed integration tests or a production queue/scheduler test.
