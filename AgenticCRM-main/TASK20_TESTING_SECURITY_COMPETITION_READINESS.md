# Task 20 — Testing, Security and Competition Readiness

## Scope and honest status

Task 20 adds a repeatable static security audit, runtime HTTP smoke tests, a database/Redis readiness probe, production-secret validation, and an explicitly opt-in fictional demo-data loader. CI now runs the Phase 2 and Task 09–20 repository verifiers before lint/type-check.

This repository change does **not** claim that live WhatsApp, external AI providers, payment gateways, production database migrations, every API route, or a real browser session have been exercised. Those require configured credentials and running infrastructure. Use the manual matrix below and retain its evidence before presenting the system as production-ready.

## Commands

From the repository root:

```bash
# Fast static checks (no database or credentials required)
pnpm verify:phase2
pnpm verify:task09
pnpm verify:task10
pnpm verify:task11
pnpm verify:task12
pnpm verify:task13
pnpm verify:task14
pnpm verify:task15
pnpm verify:task16
pnpm verify:task17
pnpm verify:task18
pnpm verify:task19
pnpm verify:task20
pnpm security:audit

# Runtime checks — start API, dashboard, PostgreSQL and Redis first
API_BASE_URL=http://localhost:3001 \
DASHBOARD_URL=http://localhost:3000 \
WHATSAPP_BASE_URL=http://localhost:3002 \
pnpm smoke:test

# Optional authenticated read checks
SMOKE_AUTH_TOKEN='<short-lived-admin-access-token>' \
API_BASE_URL=http://localhost:3001 pnpm smoke:test
```

`/api/health` is a liveness check. `/api/ready` is a dependency readiness check and returns HTTP 503 if PostgreSQL or Redis cannot be reached. The readiness response deliberately avoids returning connection strings, credentials, or raw infrastructure errors.

## Production configuration gate

Before the API starts in `NODE_ENV=production`, it now requires:

- A unique `JWT_SECRET` of at least 32 characters.
- A non-zero 64-character hexadecimal `ENCRYPTION_KEY`.
- A real `DOMAIN` hostname, without scheme or path.
- `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `REDIS_URL`.

Generate secrets using a secure secret manager or, for a local deployment, `openssl rand -hex 32`. Do not commit `.env` files or use the example values in production. Rotating `ENCRYPTION_KEY` after encrypted provider credentials have been stored can make those values unreadable; plan a controlled re-encryption before rotation.

## Fictional demo data

The loader never creates or selects a tenant implicitly. First create a dedicated demo company through the normal signup/setup flow, then run:

```bash
DEMO_MODE=true DEMO_COMPANY_SLUG='your-demo-company-slug' pnpm db:seed-demo
```

The loader is idempotent for its reserved demo identifiers, refuses production mode, requires `demo` in the tenant slug, and creates fictional contacts, leads, products, deals (with product line items) and tasks. It does not delete records, change existing records, or seed into an arbitrary tenant. Demo emails use `example.invalid`; contacts are tagged `demo` and `competition-demo` where applicable. Never use this command against a customer tenant.

## Competition demo storyline

Use the seeded demo tenant and demonstrate the following journey:

1. Open the dashboard and show the live overview and recent activity.
2. Open the lead board; show one new lead, one qualified lead, one proposal and one negotiation.
3. Open a lead profile and show its linked contact, score, source and next action.
4. Open Deals and show the weighted pipeline. Open the Northstar or BluePeak deal and show its value and stage.
5. Open Products and show the CRM, automation and storefront catalogue items.
6. Open Tasks and show the follow-up tasks, owners (if assigned in the tenant) and due dates.
7. Open the visual automation builder and demonstrate a safe internal CRM action. Use approval checkpoints for any action with external impact.
8. Open the 3D Business Command Centre and show its connected CRM entities and filters.
9. Open the AI/RAG/marketing areas only after configuring a provider and uploading approved demo documents. Explain which results are generated live and which require provider setup.
10. For WhatsApp, connect a dedicated test number and send only to consenting test recipients. Show delivery status and the conversation timeline.

Avoid demonstrating real customer phone numbers, production API keys, or private documents.

## Manual acceptance matrix

| Area | Test | Evidence to retain |
|---|---|---|
| API | Health and readiness return 200 when services are healthy; readiness returns 503 when DB or Redis is unavailable | HTTP output / CI log |
| Authentication | Valid login, invalid password, expired token, refresh rotation and logout | Test report |
| Tenant isolation | A user in tenant A cannot read or mutate tenant B contact, lead, deal, task, document or workflow IDs | Automated integration test output |
| Permissions | Agent/manager access matches configured permissions; admin-only system actions are denied to non-admin users | Role matrix |
| Persistence | Create, update, reload and delete/soft-delete supported records; verify DB state | DB/API evidence |
| Leads and CRM | Create lead, change status, update score, add note and create linked deal | Screen recording |
| WhatsApp | Connect test account, receive inbound message, reply, verify status and opt-out handling | Provider logs + recording |
| AI agents | Provider configured; tool calls are scoped to current company; risky actions require approval | Agent execution log |
| ML | Score representative held-out leads; inspect confidence/factors; verify no training/test leakage | Evaluation report |
| RAG | Upload supported document, retrieve relevant passages, inspect citations and tenant permissions | Retrieval trace |
| Storefront | Publish a product page, open public URL, verify mobile layout and unpublish | Browser recording |
| Automation | Trigger event, run condition/action, exercise retry, failure and approval paths | Workflow execution log |
| Responsive UX | Test desktop, tablet and narrow mobile widths; no horizontal overflow or inaccessible controls | Screenshots |
| Accessibility | Keyboard navigation, focus visibility, labels, contrast and reduced-motion preference | Accessibility report |
| Security | No default secrets, CORS restricted in production, DTO validation, rate limits and security headers | `pnpm security:audit` + headers |

## Known limits / required follow-up

- The HTTP smoke test is a targeted health/authentication check, not exhaustive coverage of every controller method.
- The static security audit is a regression guard, not a penetration test or a substitute for dependency vulnerability scanning.
- Tenant isolation and role enforcement must be verified with two real test tenants and at least two roles. Do not infer full isolation from route decorators alone.
- Live provider flows require provider credentials, webhook URLs, consented test accounts and external callback verification.
- Full `pnpm install`, Prisma generation/migrations, Jest, lint, type-check, Next.js build and Docker builds must run in CI or a configured development environment before release.
- Add real browser E2E coverage (for example Playwright) and API integration coverage as the next hardening step if these are not already supplied by the deployment pipeline.
