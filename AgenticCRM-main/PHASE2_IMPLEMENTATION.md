# AgenticCRM Phase 2 — T04 to T08

This release is based on the uploaded Phase 1 repository. Existing CRM services, APIs, Prisma models, WhatsApp transport, authentication and permission checks are reused wherever available.

## Task coverage

| Task | Implementation | Status / boundary |
|---|---|---|
| T04 — Unified Lead Management | Reuses the existing leads list, filters, kanban, scoring, duplicate detection, detail page, activity timeline, lead-intake integrations and company-scoped API. The contact-ID resolver verifies that a supplied contact belongs to the active company. | Existing functionality retained; tenant-isolation guard present. |
| T05 — Communication Centre | Adds `/inbox` with conversation search/status filters, message history, outbound reply through the existing WhatsApp outbound queue, message delivery status, approved-template insertion, AI enable/pause, resolve and read actions. | Uses the configured WhatsApp account and existing Redis/WhatsApp worker. Requires a connected account and running Redis + WhatsApp service to deliver messages. |
| T06 — Call-to-CRM | Adds call-record persistence, call history, notes, transcript, summary, intent/outcome fields, provider/external IDs, contact/lead linking and conversion of a call into a lead. | Provider-neutral call logging and transcript ingestion. It does not place phone calls or generate speech transcripts/intent automatically; a telephony provider integration or transcription service must supply those events/data. |
| T07 — Product Management | Reuses existing product catalogue, product detail, variants, pricing, stock adjustments, low-stock stats, bulk operations, archive and product activity history. | Existing product CRUD/inventory APIs retained. Product price remains stored in the smallest currency unit as defined by the existing model. |
| T08 — Brand & Storefront | Adds storefront publishing controls, description, banner URL and accent colour; public `/store/:slug` page; public read-only catalogue API; only active, non-archived products are exposed. | Storefront is disabled by default and must be explicitly enabled by a company admin. |

## Files created

- `apps/dashboard/src/app/(dashboard)/inbox/page.tsx`
- `apps/dashboard/src/app/(dashboard)/calls/page.tsx`
- `apps/dashboard/src/app/(dashboard)/storefront/page.tsx`
- `apps/dashboard/src/app/store/[slug]/page.tsx`
- `apps/api/src/modules/calls/calls.controller.ts`
- `apps/api/src/modules/calls/calls.module.ts`
- `apps/api/src/modules/calls/calls.service.ts`
- `packages/database/prisma/migrations/20261115140000_phase2_call_records/migration.sql`
- `packages/database/prisma/migrations/20261115141000_phase2_storefront/migration.sql`
- `scripts/verify-phase2.mjs`
- `PHASE2_IMPLEMENTATION.md`

## Files modified

- `apps/api/src/app.module.ts` — registers CallsModule.
- `apps/api/src/modules/conversations/conversations.controller.ts` — adds mark-read endpoint.
- `apps/api/src/modules/conversations/conversations.service.ts` — adds mark-read and validates assigned agent company ownership.
- `apps/api/src/modules/products/products.controller.ts` — adds public read-only storefront endpoint.
- `apps/api/src/modules/products/products.module.ts` — registers public storefront controller.
- `apps/api/src/modules/products/products.service.ts` — adds company-scoped public storefront read model.
- `apps/api/src/modules/company/company.service.ts` — supports storefront settings and validates accent colour.
- `apps/dashboard/src/components/shell/nav-config.ts` — adds Inbox, Call CRM and Storefront navigation entries.
- `packages/database/prisma/schema.prisma` — adds CallRecord and company storefront fields/relations.
- `package.json` — adds `verify:phase2` script.

## Dependencies

No new dependencies added. Existing NestJS, Prisma, React Query, Next.js, Zustand, Lucide, Axios and toast packages are reused.

## API changes

- `POST /api/conversations/:id/read` — clear unread count after opening a conversation.
- `GET /api/calls` — paginated call history, optionally filtered by contact or lead.
- `POST /api/calls` — persist a call record and metadata.
- `PATCH /api/calls/:id` — update notes, transcript, summary, intent, outcome, duration, status or links.
- `POST /api/calls/:id/convert-to-lead` — create and associate a lead from a call linked to a contact.
- `GET /api/public/storefront/:slug` — public read-only company catalogue, only when storefront publishing is enabled.

Existing endpoints remain in use for leads, products, conversations, messages, templates and company profile updates.

## Database changes

- `CallRecord` table with company, optional contact/lead links, direction/status, provider/external ID, start time, duration, notes, transcript, summary, intent, outcome and recording URL.
- `Company.storefrontEnabled`, `storefrontDescription`, `storefrontBannerUrl`, `storefrontAccentColor`.
- SQL migrations are included under `packages/database/prisma/migrations/`.

## Verification performed in this environment

- TypeScript/TSX syntax parse passed for all changed TypeScript and TSX files using the globally available TypeScript parser.
- `node scripts/verify-phase2.mjs` passed all static file/feature acceptance checks.
- No runtime dependencies were installed: Corepack could not download pnpm because registry access was unavailable.
- No PostgreSQL, Redis, connected WhatsApp session or browser runtime was available. Therefore Prisma validation/client regeneration, migrations, API integration tests, message delivery, database persistence and end-to-end browser journeys remain unverified here.

## Local setup and verification

Run from the repository root:

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
```

Create `.env` from `.env.example` and configure at least `DATABASE_URL`, `DIRECT_DATABASE_URL`, `REDIS_URL`, API/dashboard URLs, JWT secrets and WhatsApp settings. Start PostgreSQL and Redis first.

```bash
pnpm db:generate
pnpm db:migrate
pnpm verify:phase2
pnpm dev
```

Open the dashboard on the configured frontend port (the repository dashboard defaults to `http://localhost:3001`). Verify the following journeys:

1. Leads: create/update a lead, filter/search, inspect score/timeline, test duplicate detection, and confirm a foreign-company contact ID is rejected.
2. Inbox: receive a WhatsApp message, open its conversation, verify unread count clears, send a reply, confirm it reaches the connected WhatsApp account and that delivery status updates; insert an active template; toggle AI and resolve the conversation.
3. Calls: log a call against a same-company contact, edit transcript/summary/intent/outcome, convert it to a lead, and confirm both records remain linked after reload.
4. Products: create/update a product, adjust stock, inspect variants and activity history, archive/unarchive it.
5. Storefront: configure branding, enable publishing, activate products, open `/store/<company-slug>` in a logged-out/private browser, verify only active non-archived products appear, then disable publishing and verify the public page becomes unavailable.

For production, use the repository's normal migration deployment process after reviewing the included SQL migrations; do not use `db push` as a substitute for reviewed production migrations.
