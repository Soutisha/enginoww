import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'apps/api/src/modules/leads/lead-intelligence.ts',
  'apps/api/src/modules/leads/lead-intelligence.service.ts',
  'apps/api/src/modules/leads/lead-intelligence.spec.ts',
  'apps/api/jest.config.js',
  'packages/database/prisma/migrations/20261115180000_lead_intelligence_model/migration.sql',
];
for (const file of requiredFiles) assert.ok(existsSync(file), `Missing ${file}`);

const controller = readFileSync('apps/api/src/modules/leads/leads.controller.ts', 'utf8');
for (const route of [
  "@Get('intelligence/model')",
  "@Post('intelligence/train')",
  "@Get('intelligence/prioritized')",
  "@Get(':id/intelligence')",
]) assert.ok(controller.includes(route), `Missing route ${route}`);

const service = readFileSync('apps/api/src/modules/leads/lead-intelligence.service.ts', 'utf8');
for (const capability of ['MIN_TOTAL_SAMPLES', 'MIN_PER_CLASS', 'splitTrainingExamples', 'evaluateModel', 'explainPrediction', 'companyId']) {
  assert.ok(service.includes(capability), `Missing model capability ${capability}`);
}

const schema = readFileSync('packages/database/prisma/schema.prisma', 'utf8');
assert.ok(schema.includes('model LeadScoringModel'));
assert.ok(schema.includes('leadScoringModel LeadScoringModel?'));

const ui = readFileSync('apps/dashboard/src/app/(dashboard)/leads/page.tsx', 'utf8');
for (const capability of ['AI Lead Intelligence', 'Train model', 'conversionProbability', 'Top factors']) {
  assert.ok(ui.includes(capability), `Missing UI capability ${capability}`);
}

console.log(`Task 09 static verification passed (${requiredFiles.length} required files, 4 API routes, Prisma persistence and UI checks).`);
