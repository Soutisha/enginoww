# Phase 3 — Task 09: AI Lead Intelligence

## Scope delivered

- Company-specific logistic-regression conversion model trained from historical resolved leads.
- Training labels: `WON` = positive; `LOST` and `DISQUALIFIED` = negative.
- Features: estimated value, priority, source, high-intent/cold tags, tag count and assignment presence. Terminal status is never used as a feature.
- Deterministic stratified 80/20 holdout evaluation with accuracy, precision, recall, F1 and ROC AUC.
- Minimum training gate: 20 resolved leads overall and at least 5 examples in each outcome class.
- Model weights, bias, feature names, version, sample counts and holdout metrics persist in PostgreSQL per company.
- Prediction returns conversion probability, HIGH/MEDIUM/LOW intent and ranked feature contributions.
- Prioritised open-lead endpoint and leads-page UI for training, metrics and top opportunities.
- Existing rule-based lead score and `LeadScoreEvent` history are preserved; ML predictions are a separate signal and do not overwrite manual/rule scores.

## API

- `GET /api/leads/intelligence/model`
- `POST /api/leads/intelligence/train`
- `GET /api/leads/intelligence/prioritized?limit=50`
- `GET /api/leads/:id/intelligence`

All routes inherit JWT authentication, company scope and the existing `leads` permission guard.

## Database

Adds `LeadScoringModel`, one persisted model per company. Migration:
`packages/database/prisma/migrations/20261115180000_lead_intelligence_model/migration.sql`.

## Files created

- `apps/api/src/modules/leads/lead-intelligence.ts`
- `apps/api/src/modules/leads/lead-intelligence.service.ts`
- `apps/api/src/modules/leads/lead-intelligence.spec.ts`
- `apps/api/jest.config.js`
- `packages/database/prisma/migrations/20261115180000_lead_intelligence_model/migration.sql`
- `scripts/verify-task09.mjs`
- `PHASE3_TASK09_IMPLEMENTATION.md`

## Files modified

- `packages/database/prisma/schema.prisma`
- `apps/api/src/modules/leads/leads.controller.ts`
- `apps/api/src/modules/leads/leads.module.ts`
- `apps/dashboard/src/app/(dashboard)/leads/page.tsx`
- `package.json`

## Dependencies

No dependencies added. The model uses an in-process TypeScript logistic-regression implementation and the existing PostgreSQL/Prisma stack.

## Important limitations

- This is a tabular ML model, not an LLM. It is intentionally explainable and repeatable.
- It requires sufficient historical resolved leads. It will refuse to train on small or single-class datasets rather than fabricate training data or return misleading metrics.
- Predictions are based on stable CRM fields currently available in the Lead model. They do not infer conversational intent from message text or claim speech/NLP understanding.
- The 80/20 evaluation is a deterministic stratified holdout. Model metrics should be reviewed on each company's real data before operational decisions are automated.
- No production data or model has been fabricated. Training happens only when an authorized user requests it.
