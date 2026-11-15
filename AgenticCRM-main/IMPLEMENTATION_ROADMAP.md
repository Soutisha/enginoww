# AgenticCRM — Repository Audit & Implementation Roadmap

Audit date: 15 Nov 2026 · Repo version: `1.5.2` · Method: static read of the source (no runtime, no DB).

> **Important caveat — "Enginow PS2".** No Enginow problem statement exists in the repo or the upload, so
> section 6 maps the codebase to the capabilities a WhatsApp-first agentic CRM would normally be judged on.
> It is **provisional**. Paste the PS2 text and the mapping table should be re-scored against its literal requirements.

---

## 1. What the project is

Self-hosted, WhatsApp-centric CRM with an AI agent. pnpm + Turborepo monorepo, ~73k lines of TS/TSX (hand-written; excludes generated Prisma client).

| App / package | Stack | Role |
|---|---|---|
| `apps/api` | NestJS 11, Prisma, Socket.io, BullMQ | REST API, 36 modules, WS gateway, AI chat + 390+ admin tools |
| `apps/worker` | BullMQ, Pino | Background jobs + customer-facing AI agent loop (8 tools, 3 providers) |
| `apps/whatsapp` | Baileys (multi-session) | WhatsApp transport, inbound normalisation, outbound sender |
| `apps/dashboard` | Next.js 16, React 19, Tailwind 3, TanStack Query, Zustand, Recharts | Web UI, ~60 routes |
| `packages/database` | Prisma 7 / PostgreSQL + pgvector | ~130 models/enums, single schema (3,036 lines) |
| `packages/shared` | TS | Queue names, WS events, permissions, FSM, validators |

## 2. Module map

### API modules (`apps/api/src/modules`)
- **Core CRM:** contacts, leads, lead-intake (Meta/custom webhooks), deals, pipelines, tasks, products, tags
- **Messaging:** conversations, messages, broadcast, campaigns, sequences, templates, forms
- **Sales ops:** quotes, invoices, payments (Razorpay, Stripe, Cashfree, PhonePe, PayU)
- **Support:** tickets (SLA), knowledge-base, documents (+ signatures)
- **Intelligence:** ai-chat, ai-memory, memory (pgvector), analytics, reports, workflows
- **Platform:** auth, team (RBAC), company, settings (AI/WhatsApp/payments), api-keys, integrations, system (self-update)

### Dashboard routes
analytics · reports · chat (AI) · memory · docs · contacts · leads (+kanban, api-keys, integrations, api-docs) · deals · tasks (+kanban, recurrences) · products · broadcasts · templates · sequences · campaigns · forms · quotes · invoices · payments · tickets · kb · workflows · documents · integrations · settings/* (ai, company, integrations, payments, system, team, webhooks, whatsapp) · setup · public pages (forms, invoices, quotes, kb) · login.

### Worker jobs
reminder, follow-up (30 min), cleanup, payment-check, warmup-reset, memory-dreaming (6 h), lead-decay, deal-cycle, task-cycle, sequence-execution, campaign-scheduler/send, broadcast, ai-message.

## 3. Existing APIs relevant to the dashboard

`GET /analytics/` → `dashboard`, `summary`, `revenue`, `funnel`, `pipeline`, `leads/sources`, `contacts/growth`, `agents`, `broadcasts`, `messages/volume`, `tickets`, `response-times`, `top-contacts`, `tags`, `compare`, plus legacy `conversations/trend`, `deals/funnel`, `agents/performance`.
Conversations: `GET /conversations`, `/:id`, `/:id/messages`, `POST assign | resolve | toggle-ai`. Messages: `POST /messages/send`.
Tasks / leads / deals each expose list + stats endpoints (leads and deals have forecast helpers).

## 4. Database tables the dashboard can use

| Dashboard widget | Source | Notes |
|---|---|---|
| Revenue overview | `Payment` (`status=PAID`, `paidAt`, `amount`) | **Minor units (paise).** |
| Total leads / conversion | `Lead` (`status`, `createdAt`, `wonAt`) | Funnel endpoint exists. |
| Pending follow-ups | `Task` (`dueAt`, open statuses), `Lead.nextActionAt`, `Deal.nextActionAt`, `Conversation.status=WAITING_HUMAN` | No single endpoint. |
| Daily activity | `Message` by `createdAt`/`direction`; `messages/volume` endpoint | Exists. |
| Sales funnel | `Lead` statuses / `Deal.stage` | Exists (`funnel`, `pipeline`). |
| Recent conversations | `Conversation` (+contact, last message, assignee) | List endpoint exists; no "recent N" shape. |
| Agent activity | `Message.isAiGenerated/aiProvider/aiModel/aiTokensUsed`, `LeadActivity/DealActivity/TaskActivity.actorType`, `ChatMessage` | `agents` endpoint only covers **human** users. |

## 5. Findings

### 5.1 Broken or silently failing
| # | Finding | Evidence | Severity |
|---|---|---|---|
| B1 | **Follow-up notifications never get created.** Worker calls `notification.create` with `conversationId`, which is not a field on `Notification`; Prisma rejects it and the `.catch()` logs a misleading "model not set up" warning. | `worker/jobs/follow-up.processor.ts`, `schema.prisma` `Notification` | High |
| B2 | **Money units are inconsistent.** `Payment.amount` is `Int` in paise (analytics divides by 100), but `Deal.value`/`Lead.estimatedValue` are `Float` and the deals UI prints them as whole rupees. Mixing them on one dashboard will mislabel figures. | `schema.prisma`, `deals/page.tsx`, `analytics/page.tsx` | High |
| B3 | ✅ *Fixed in Task 03.* **No landing dashboard.** `/` redirected to `/chat`, and route gating sent every unpermitted route to `/chat` even for users lacking `ai_chat` (exempt from the check, so no loop, but the AI chat API then rejects them). | `(dashboard)/page.tsx`, `layout.tsx` | Medium |
| B4 | ⚠️ *Still present in `/analytics`; not touched.* **Dynamic Tailwind classes** (`bg-${color}-50`) in the analytics KpiCard are purged in production builds, so icon colours vanish. | `analytics/page.tsx` | Medium |
| B5 | **`ActivityLog` is never written** by any code, so it cannot back an activity feed. | grep for `activityLog.create` → 0 hits | Medium |
| B6 | Sequence steps `send_email` and `ai_task` are stubs that report success without doing anything — in both API and worker copies (duplicated logic). | `sequence-execution.service.ts` (api + worker) | Medium |
| B7 | `getAgentPerformance` runs one `message.count` per user in a loop (N+1). | `analytics.service.ts` | Low |
| B8 | `ai-chat/admin-tools.ts` is a 9,167-line single file. | — | Maintainability |

### 5.2 Gaps
- **No WhatsApp inbox UI.** Conversations/messages APIs, `inbox.store.ts` and socket handlers exist, but no route renders them. The `/chat` page is the staff↔AI assistant, not the customer inbox. This is the largest functional hole for a WhatsApp CRM.
- **Zero tests.** No `*.test`/`*.spec` files; CI's `test` job passes via `--passWithNoTests`. The CI `type-check` task is also missing from `packages/*`.
- **Global cache invalidation:** every successful mutation calls `invalidateQueries()` for the whole cache with `staleTime: 0`. Works, but over-fetches and will make a data-heavy dashboard flicker.
- **Generated/compiled artefacts committed:** `packages/*/src/**/*.js(.map)` and `packages/database/generated/client` (including a macOS-arm64 query-engine binary). The `.gitignore` only excludes `packages/shared/src/index.js`.
- **No design system.** No `components/` directory; each page hand-rolls cards, tables, modals and skeleton-free loading. Colours are hard-coded (`bg-[#fafafa]`, `#0f0f10`, indigo hex arrays). Light-only; base font 13px; sidebar is hover-expand only (no mobile layout).
- **Notification UI missing:** WS event `notification.new` and `Notification` model exist; nothing renders them.
- **Docs drift:** README says "8 registered tools" for the customer agent while staff AI exposes 390+; CI pins `APP_VERSION=1.0.0` vs package `1.5.2`.

### 5.3 Working well (keep, don't rebuild)
Auth + refresh flow, permission-based RBAC (API guard + sidebar filtering), company scoping on every query, WS gateway, AI provider abstraction with fallback chain, circuit breaker, pgvector memory, payments gateways, forms/quotes/invoices public pages, extensive analytics endpoints.

## 6. Provisional mapping to Enginow PS2

| Capability | Status | Where |
|---|---|---|
| WhatsApp channel integration | ✅ Built | `apps/whatsapp` |
| AI agent answering customers | ✅ Built (8 tools, escalation) | `worker/agent` |
| Lead capture & scoring | ✅ Built | leads, lead-intake, forms |
| Pipeline / deals | ✅ Built | deals, pipelines |
| Follow-ups & reminders | ⚠️ Partial — reminders work, conversation follow-up notifications broken (B1) | worker |
| Business dashboard / analytics | ⚠️ Partial — rich API, no home dashboard | analytics |
| Human agent inbox / handoff | ❌ UI missing (API ready) | conversations |
| Automation (workflows, sequences) | ⚠️ Partial — email/ai_task steps stubbed (B6) | workflows, sequences |
| Notifications | ❌ Model + WS event only | — |
| Tests / quality gates | ❌ None | — |
| Premium, consistent UI | ❌ Ad-hoc per page | dashboard |

## 7. Roadmap

### Phase 1 — Foundation
1. **Task 01** — this audit. ✅
2. **Task 02 — UI foundation.** Tokens (CSS variables, dark-first), `components/ui` (Card, Button, Badge, DataTable, Modal, Skeleton, EmptyState, ChartCard), `motion` page/stagger transitions, responsive shell (mobile drawer, pinned/collapsible sidebar), fix B4.
3. **Task 03 — Dashboard.** New `GET /analytics/overview` endpoint (single round-trip, company-scoped, unit-safe), `/` route renders it; fixes B2 at the boundary (all money returned in major units with explicit `currency`) and B3.

### Status after Tasks 02 and 03 (implemented)

| Item | Result |
|---|---|
| Design tokens | CSS-variable tokens (dark default) in `globals.css`, mapped into `tailwind.config.ts`. Geist font. Original light tokens preserved under `.legacy-canvas`. |
| Shell | `components/shell/*`: collapsible sidebar (persisted), mobile drawer, top bar, skip link, update banner kept, permission-aware fallback routing (B3). |
| Component library | `components/ui/*`: Card, Button, Badge, Skeleton, EmptyState, Modal (focus trap, Esc, scroll lock), DataTable, StatCard, ChartCard, Stagger/PageTransition (Motion, reduced-motion aware). |
| Migration strategy | Only `/` is on the dark system (`MIGRATED_ROUTES` in `nav-config.ts`). Every other page renders unchanged on a light canvas inside the new shell. Migrate route by route, then delete the wrapper. |
| Dashboard | `GET /analytics/overview?days=7/30/90` (new `overview.service.ts`) feeds `/`: revenue, total leads, conversion, pending follow-ups, daily activity, funnel, recent conversations, agent activity. Money returned in major units + currency (B2 handled at the API boundary only). |
| Verified | `tsc --noEmit` clean for `api` and `dashboard`; ESLint clean on new dashboard files; rendered in Chromium against a mocked API (desktop, mobile + drawer, empty state, legacy page). |
| **Not verified** | The overview SQL/Prisma queries have **not run against a real PostgreSQL** (none available here). `next build` not run (Google Fonts unreachable in the sandbox). No automated tests added. |

### Phase 1.5 — Fix-first items surfaced by the audit
- Fix B1 (use `Notification` fields; add `link`), then render notifications in the shell.
- Decide a single money convention (recommend minor units everywhere, migrate `Deal.value`), or document the split.
- Add a minimal test harness (Jest for analytics service; Playwright smoke for login → dashboard).

### Phase 2 (proposed)
Customer **Inbox** UI using the existing conversations API + `inbox.store`; implement sequence `send_email`/`ai_task`; write to `ActivityLog` (or drop it); split `admin-tools.ts`; remove committed build artefacts.

## 8. Risks & assumptions
- Everything above is from static reading; nothing was executed against a database.
- The Enginow PS2 mapping is provisional until the statement is provided.
- Changing `Deal.value` units needs a data migration and touches the AI tools; not attempted in Phase 1.

## Task 18 — 3D Business Command Centre (implemented)

The separate BizPilot 20-task roadmap defines Task 18 as the 3D Business Command Centre. The implementation is documented in `TASK18_3D_BUSINESS_COMMAND_CENTRE.md`: company-scoped CRM graph API, customer/lead/deal/product/team nodes, contact→lead, lead→deal, contact→deal and product→deal edges, recent AI/workflow/conversation activity, interactive 3D-projected dashboard, entity filters and CRM deep links. The renderer currently uses a dependency-free Canvas 2D perspective projection rather than Three.js/React Three Fiber because the repository had no 3D dependency and package-registry access was unavailable. Replace the renderer with R3F when dependencies can be installed and the pnpm lockfile regenerated.
