# BizPilot — All-in-One Business Automation Platform

**Live application:** https://bizpilot-dashboard-soutisha-z15s.onrender.com/login  
**API:** https://bizpilot-api-soutisha-z15s.onrender.com  
**Source code:** https://github.com/Soutisha/enginoww

BizPilot is a unified business operations platform designed for small businesses that need to manage customer enquiries, sales pipelines, follow-ups, products, brand assets and business performance without switching between disconnected tools.

This project addresses **PS2: BizPilot, an All-in-One Business Automation Platform**.

> **Deployment note:** The public Render deployment currently includes the dashboard and API. The repository also contains separate BullMQ worker and WhatsApp Baileys services, but those two background services are not currently deployed in the hosted Render environment. Features that depend on background queues or a live WhatsApp session therefore require those services to be running. AI features also require an active OpenAI API key with available API quota.

## 1. Problem statement

Small businesses often receive enquiries through multiple channels, maintain product information in separate places and rely on manual reminders to follow up with potential customers. This fragmentation leads to missed leads, inconsistent customer communication, slow sales cycles and limited visibility into business performance.

PS2 asks for a single platform that brings together lead management, automation, product listings, brand setup and an at-a-glance dashboard.

## 2. Proposed solution

BizPilot brings the core customer, sales and brand workflows into one workspace. A business team can manage contacts and leads, track deals, organise tasks, maintain a product catalogue, configure AI assistance and view business activity from a shared dashboard.

The application is workspace-scoped: authenticated users work within their own company data, with roles and permissions controlling access to business functions.

## 3. How BizPilot addresses PS2

| PS2 requirement | BizPilot implementation |
|---|---|
| Lead management | Central contacts and lead records, lead status and source tracking, lead-to-deal conversion, integrations and form-based lead capture |
| Calls and WhatsApp | Call activity records and WhatsApp inbox/account management are represented in the CRM; live WhatsApp messaging requires the Baileys service and a connected account |
| Automation | Follow-up tasks and reminders, reusable templates, sequences, campaigns and event-driven workflows; queue-driven execution requires the BullMQ worker |
| Product listing | Product catalogue with pricing, categories, stock information and product-to-deal line items |
| Brand setup | Company profile and branding settings, logo and storefront fields, accent colour and marketing asset generation |
| Dashboard | Business analytics, lead/deal pipeline views, conversion and activity reporting, custom reports and charts |
| Bonus: AI | OpenAI-powered assistant and AI workflows, including CRM actions and marketing/content drafting; requires a configured API key and available API quota |
| Bonus: team roles | Super Admin, Admin, Manager and Agent roles with workspace permissions |

## 4. Key features

### Unified CRM
- Contact directory with search, tags, notes and customer activity.
- Lead tracking with status, source, priority, score and expected value.
- Deal pipeline with stages, value, probability and linked products.
- Task management with due dates, priorities, assignments and recurring task support.
- Lead conversion into deals and connected customer records.

### Customer engagement and automation
- WhatsApp inbox and account-management screens.
- Reusable message templates and campaign management.
- Multi-step sequences and follow-up scheduling.
- Workflow configuration for business events and actions.
- Human hand-off and team-based customer support workflows.

### Products, storefront and marketing
- Product catalogue and pricing management.
- Company profile and brand settings.
- Storefront configuration fields for description, banner and accent colour.
- Marketing Studio for drafting promotional content and campaign assets.

### Analytics and reporting
- Business analytics and pipeline visibility.
- Custom report creation, execution and activity history.
- Sample reports for contacts, leads, deals, tasks and simulated payments.
- Demo data is clearly marked as fictional. Demo payments are simulated and must not be treated as actual revenue.

### AI assistance
- OpenAI integration for AI-assisted CRM workflows.
- Natural-language assistant and CRM tool execution.
- Marketing copy and customer-reply drafting.
- AI functionality depends on a valid API key, model access and sufficient API credits.

## 5. What makes BizPilot different

1. **One connected workspace:** Customer records, sales, tasks, products, marketing and reporting are designed to work together.
2. **Operational rather than isolated AI:** AI is integrated with CRM actions and workflow execution rather than being limited to a standalone chat interface.
3. **Workspace-level data separation:** Company-scoped access helps keep business records separated between workspaces.
4. **Human control:** Roles, permissions and human hand-off complement automation.
5. **Demo-safe data:** Sample records carry a dedicated marker, and simulated payments are explicitly distinguished from real transactions.

## 6. Architecture

BizPilot is a TypeScript monorepo. The dashboard communicates with the NestJS API; the API uses PostgreSQL through Prisma and Redis for queue/event coordination. Separate services process background jobs and maintain WhatsApp sessions.

```text
                         Business users
                               |
                               v
                    Next.js Dashboard
                     React + Tailwind
                               |
                         HTTPS / API
                               |
                               v
                       NestJS REST API
                         /         \
                        /           \
                       v             v
                PostgreSQL          Redis
                + Prisma              |
                                     |
                          +----------+----------+
                          |                     |
                          v                     v
                    BullMQ Worker       WhatsApp Service
                    AI + workflows      Baileys sessions
                    reminders           inbound/outbound
                    campaigns           message events
```

**Service responsibilities**

| Component | Responsibility |
|---|---|
| Dashboard | Web interface for CRM, analytics, reports, settings and business workflows |
| API | Authentication, workspace-scoped business logic, REST endpoints and WebSocket events |
| PostgreSQL | Persistent company, user, CRM, product, payment and reporting data |
| Prisma | Database schema, client generation and data access |
| Redis | Queue transport, event coordination and WhatsApp/API communication |
| BullMQ worker | Background AI processing, reminders, follow-ups, campaigns and workflow jobs |
| WhatsApp service | Baileys session lifecycle, QR/session handling and outbound message processing |

## 7. Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | NestJS 11, Node.js 22, TypeScript |
| Database | PostgreSQL 16, Prisma 7, pgvector |
| Queue and cache | Redis 7, BullMQ 5 |
| WhatsApp | Baileys |
| AI | OpenAI API |
| Realtime | Socket.IO |
| Monorepo/build | pnpm 10, Turborepo |
| Deployment | Docker, Render |

## 8. Live demo

- **Application login:** https://bizpilot-dashboard-soutisha-z15s.onrender.com/login
- **Dashboard base URL:** https://bizpilot-dashboard-soutisha-z15s.onrender.com
- **API health endpoint:** https://bizpilot-api-soutisha-z15s.onrender.com/api/health
- **API readiness endpoint:** https://bizpilot-api-soutisha-z15s.onrender.com/api/ready

The health endpoint checks API liveness. The readiness endpoint checks database and Redis connectivity. A healthy API response does not by itself mean the separate worker and WhatsApp services are deployed.

### Demo-data walkthrough

1. Open the application login page and sign in with an authorised workspace account.
2. Navigate to **Settings → Company** or open https://bizpilot-dashboard-soutisha-z15s.onrender.com/settings/company.
3. As a workspace administrator, select **Load Demo Data**.
4. Open the CRM modules, Analytics and Reports to explore the fictional sample records.

The demo loader is scoped to the signed-in workspace. It does not choose a tenant automatically. Sample WhatsApp conversations are offline examples; they do not send messages. Simulated payments do not call a payment gateway.

## 9. Run locally

### Prerequisites
- Node.js 22
- pnpm 10 (Corepack can activate the pinned version)
- Docker Desktop / Docker Engine with Docker Compose
- Git

### 9.1 Clone and install

```bash
git clone https://github.com/Soutisha/enginoww.git
cd enginoww/AgenticCRM-main

corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` in place of `cp`.

### 9.2 Configure local environment

Edit `.env`. For the development infrastructure compose file, use the local connection values below and generate your own secrets. Do not commit `.env` or share secret values.

```env
NODE_ENV=development
DATABASE_URL=postgresql://crm:devpassword@localhost:5432/wacrm
DIRECT_DATABASE_URL=postgresql://crm:devpassword@localhost:5432/wacrm
REDIS_URL=redis://localhost:6379
API_PORT=3000
CORS_ORIGINS=http://localhost:3001
JWT_SECRET=replace-with-a-random-secret
ENCRYPTION_KEY=replace-with-a-random-32-byte-hex-key
```

The development Compose file starts PostgreSQL, Redis and MinIO:

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```

### 9.3 Prepare the database

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

The seed command creates the initial company and administrator using `COMPANY_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment. Change the sample/default credentials before using the application beyond local testing.

### 9.4 Start the application

Start the API in one terminal. In Bash, load the local variables and launch the NestJS development server:

```bash
set -a
source .env
set +a
pnpm --filter @wacrm/api exec nest start --watch
```

In Windows PowerShell, load the key/value pairs from `.env` before starting the API:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\\s*([^#][^=]*)=(.*)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @wacrm/dashboard dev
```

On Windows PowerShell, set the dashboard variable first:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://localhost:3000"
pnpm --filter @wacrm/dashboard dev
```

Open **http://localhost:3001**.

### 9.5 Optional background services

For queue-driven automation and live WhatsApp functionality, keep the local PostgreSQL and Redis services running and start the relevant processes in separate terminals:

```bash
pnpm --filter @wacrm/worker dev
pnpm --filter @wacrm/whatsapp dev
```

Configure and test an AI provider from the dashboard before enabling AI replies. A valid OpenAI API key and sufficient API quota are required for OpenAI-backed features.

### 9.6 Stop local infrastructure

```bash
docker compose -f deploy/docker-compose.dev.yml down
```

To remove local database and object-storage data as well, use `docker compose -f deploy/docker-compose.dev.yml down -v`. This permanently deletes the local Compose volumes.

## 10. Deployment

The repository includes a Render Blueprint at `AgenticCRM-main/render.yaml` for the dashboard and API web services. The deployed public dashboard and API URLs are listed in the Live demo section.

For a complete self-hosted stack, the repository also includes Dockerfiles for the API, dashboard, worker and WhatsApp services, plus Docker Compose configuration under `AgenticCRM-main/deploy/`. Review environment values, persistent storage, secrets, database backups, HTTPS and service health before production use.

## 11. Security and operational notes

- Never commit `.env`, passwords, API keys, database URLs or WhatsApp session credentials.
- Generate unique production values for `JWT_SECRET` and `ENCRYPTION_KEY`; retain the encryption key because stored encrypted credentials depend on it.
- Configure OpenAI credentials through the application settings and ensure the API account has available quota.
- Use HTTPS and restrict access to administrative accounts.
- Verify the API readiness endpoint and worker/WhatsApp process logs when testing background features.
- Use test-mode payment credentials when integrating a payment gateway.
- Keep fictional demo data separate from real customer and financial records.

## 12. Repository layout

```text
enginoww/
└── AgenticCRM-main/
    ├── apps/
    │   ├── api/          # NestJS backend
    │   ├── dashboard/    # Next.js web application
    │   ├── worker/       # BullMQ background processors
    │   └── whatsapp/     # Baileys WhatsApp service
    ├── packages/
    │   ├── database/     # Prisma schema and database utilities
    │   └── shared/       # Shared types and utilities
    ├── deploy/           # Docker Compose and deployment assets
    ├── scripts/          # Verification, audit and smoke-test scripts
    ├── render.yaml       # Render web-service blueprint
    └── package.json
```

## 13. Future enhancements

- Deploy and monitor the dedicated worker and WhatsApp services in the hosted environment.
- Add further verified call-provider integrations and inbound lead ingestion connectors.
- Expand storefront publishing and branded product catalogue capabilities.
- Add end-to-end automated tests for critical sales and automation journeys.
- Improve operational monitoring for queue latency, failed jobs and message delivery.

## License

This project includes an MIT license. See [AgenticCRM-main/LICENSE](AgenticCRM-main/LICENSE).
) {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
pnpm --filter @wacrm/api exec nest start --watch
```

Start the dashboard in another terminal:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @wacrm/dashboard dev
```

On Windows PowerShell, set the dashboard variable first:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://localhost:3000"
pnpm --filter @wacrm/dashboard dev
```

Open **http://localhost:3001**.

### 9.5 Optional background services

For queue-driven automation and live WhatsApp functionality, keep the local PostgreSQL and Redis services running and start the relevant processes in separate terminals:

```bash
pnpm --filter @wacrm/worker dev
pnpm --filter @wacrm/whatsapp dev
```

Configure and test an AI provider from the dashboard before enabling AI replies. A valid OpenAI API key and sufficient API quota are required for OpenAI-backed features.

### 9.6 Stop local infrastructure

```bash
docker compose -f deploy/docker-compose.dev.yml down
```

To remove local database and object-storage data as well, use `docker compose -f deploy/docker-compose.dev.yml down -v`. This permanently deletes the local Compose volumes.

## 10. Deployment

The repository includes a Render Blueprint at `AgenticCRM-main/render.yaml` for the dashboard and API web services. The deployed public dashboard and API URLs are listed in the Live demo section.

For a complete self-hosted stack, the repository also includes Dockerfiles for the API, dashboard, worker and WhatsApp services, plus Docker Compose configuration under `AgenticCRM-main/deploy/`. Review environment values, persistent storage, secrets, database backups, HTTPS and service health before production use.

## 11. Security and operational notes

- Never commit `.env`, passwords, API keys, database URLs or WhatsApp session credentials.
- Generate unique production values for `JWT_SECRET` and `ENCRYPTION_KEY`; retain the encryption key because stored encrypted credentials depend on it.
- Configure OpenAI credentials through the application settings and ensure the API account has available quota.
- Use HTTPS and restrict access to administrative accounts.
- Verify the API readiness endpoint and worker/WhatsApp process logs when testing background features.
- Use test-mode payment credentials when integrating a payment gateway.
- Keep fictional demo data separate from real customer and financial records.

## 12. Repository layout

```text
enginoww/
└── AgenticCRM-main/
    ├── apps/
    │   ├── api/          # NestJS backend
    │   ├── dashboard/    # Next.js web application
    │   ├── worker/       # BullMQ background processors
    │   └── whatsapp/     # Baileys WhatsApp service
    ├── packages/
    │   ├── database/     # Prisma schema and database utilities
    │   └── shared/       # Shared types and utilities
    ├── deploy/           # Docker Compose and deployment assets
    ├── scripts/          # Verification, audit and smoke-test scripts
    ├── render.yaml       # Render web-service blueprint
    └── package.json
```

## 13. Future enhancements

- Deploy and monitor the dedicated worker and WhatsApp services in the hosted environment.
- Add further verified call-provider integrations and inbound lead ingestion connectors.
- Expand storefront publishing and branded product catalogue capabilities.
- Add end-to-end automated tests for critical sales and automation journeys.
- Improve operational monitoring for queue latency, failed jobs and message delivery.

## License

This project includes an MIT license. See [AgenticCRM-main/LICENSE](AgenticCRM-main/LICENSE).
