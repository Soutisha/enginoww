# Phase 3 — Task 10: Multi-agent AI Workforce

## Implemented
- Eight specialist roles: Lead Intelligence, Sales, Customer Support, WhatsApp, Follow-up, Product, Brand and Analytics.
- Company-scoped workforce runs with shared context and sequential specialist delegation. Each specialist receives prior specialist findings.
- Human approval gate: new runs remain `PENDING_APPROVAL`; only an authorized approval enqueues execution. Pending runs can be rejected.
- BullMQ worker executes each specialist using the company's existing configured AI provider/API key. No new provider or dependency is introduced.
- Per-agent output, token usage and timestamps are persisted after each specialist. Run status and failures are persisted.
- Dashboard at `/agents` supports run creation, agent selection, approval/rejection, history and output review.
- Agents are intentionally advisory: they do not send WhatsApp messages, mutate CRM records, or execute external actions. This prevents unattended side effects; outputs are recommendations and drafts for human action.

## APIs
- `GET /api/agents/workforce`
- `GET /api/agents/workforce/:id`
- `POST /api/agents/workforce` — body `{ title, objective, agents, sharedContext? }`
- `POST /api/agents/workforce/:id/approve`
- `POST /api/agents/workforce/:id/reject`

All endpoints use JWT authentication, company scope and `ai_chat` permission. Run lookup is always scoped by companyId.

## Persistence
- Added `MultiAgentRun` with objective, selected agents, shared context, per-agent task results, approval metadata, status, timestamps and error.
- Migration: `20261115190000_multi_agent_workforce`.

## Files created
- `apps/api/src/modules/agents/agents.module.ts`
- `apps/api/src/modules/agents/agents.controller.ts`
- `apps/api/src/modules/agents/agents.service.ts`
- `apps/worker/src/jobs/multi-agent.processor.ts`
- `apps/dashboard/src/app/(dashboard)/agents/page.tsx`
- `packages/database/prisma/migrations/20261115190000_multi_agent_workforce/migration.sql`
- `scripts/verify-task10.mjs`
- `PHASE3_TASK10_IMPLEMENTATION.md`

## Files modified
- `packages/database/prisma/schema.prisma`
- `packages/shared/src/constants/queue-names.ts`
- `apps/api/src/app.module.ts`
- `apps/worker/src/main.ts`
- `apps/dashboard/src/components/shell/nav-config.ts`
- root `package.json`

## Dependencies
None added. Uses existing NestJS, Prisma, BullMQ, Redis and AI provider abstraction.

## Limitations
- Agents run sequentially, not in parallel, so that later specialists can use earlier findings.
- The workforce uses the company's configured primary AI provider; it does not have per-agent provider configuration.
- No automatic tool execution or outbound messaging is enabled. Human approval authorizes the AI analysis run, not downstream external actions.
- The feature requires a valid AI provider/API key and Redis worker.
- Runtime acceptance (PostgreSQL migration, Redis queue, provider call, browser flow) has not been performed in this environment.
