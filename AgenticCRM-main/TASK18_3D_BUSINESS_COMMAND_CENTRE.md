# Task 18 — 3D Business Command Centre

## Delivered

- Added a company-scoped `GET /analytics/command-centre` snapshot endpoint.
- Snapshot includes live CRM records for contacts, leads, deals, products and active team members; real contact→lead and contact/lead→deal and product→deal relationship edges; current handoff counts; AI replies from the last 24 hours; recent conversations; AI replies; and workflow executions.
- Added `/command-centre` to the dashboard navigation under Overview and migrated it to the dark application shell.
- Added an interactive 3D-projected business network. Drag to rotate, select an object to inspect it, filter entity types, and open the corresponding CRM module.
- Added KPI tiles, team presence, recent activity and automation context.
- Dashboard refreshes every 30 seconds and listens to existing company WebSocket events (`message.new`, `conversation.updated`, `notification.new`) when connected.
- No demo entities are injected. Empty states are based on the company's actual records.
- No database migration is required.

## Data and security

- The endpoint uses the authenticated user's `companyId` for every query and inherits the existing analytics permission, JWT and company-scope guards.
- Contact, lead, deal, product, user, conversation, message and workflow-execution records are read-only.
- CRM relationships are only drawn when the corresponding related records are in the current snapshot.
- Product prices are converted from stored minor units to major units for display. Deal and lead estimated values retain their existing major-unit representation.

## Rendering implementation note

The repository did not include Three.js or React Three Fiber, and package-registry access was unavailable in the implementation environment. To keep the feature buildable without adding an unresolvable dependency or corrupting the pnpm lockfile, the network scene uses a dependency-free animated Canvas 2D renderer with 3D coordinates, perspective projection, depth sorting, rotation, orbit guides and selectable nodes. It is an interactive 3D-projected view, but it is not a Three.js/React Three Fiber scene. A later dependency-enabled pass can replace the renderer while preserving the API and node contract.

## Verification

Run:

```bash
pnpm verify:task18
pnpm --filter @wacrm/api type-check
pnpm --filter @wacrm/dashboard type-check
```

The static verifier checks the route, company-scoped queries, CRM relationships, real-time refresh wiring and interactive scene. Full API/dashboard type-checks and browser rendering require installing dependencies and configuring the database/Redis services. They were not available in this environment.
