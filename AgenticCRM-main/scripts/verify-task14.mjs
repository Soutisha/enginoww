import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['Predictive service exists', 'apps/api/src/modules/analytics/predictive-analytics.service.ts'],
  ['Predictive endpoint is registered', 'apps/api/src/modules/analytics/analytics.controller.ts'],
  ['Predictive service is provided', 'apps/api/src/modules/analytics/analytics.module.ts'],
  ['Predictive analytics UI exists', 'apps/dashboard/src/app/(dashboard)/analytics/predictive/page.tsx'],
  ['Analytics links to predictive insights', 'apps/dashboard/src/app/(dashboard)/analytics/page.tsx'],
  ['Task 14 documentation exists', 'TASK14_PREDICTIVE_BUSINESS_ANALYTICS.md'],
];
let failed = 0;
for (const [label, file] of checks) {
  const ok = fs.existsSync(path.join(root, file));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
const service = fs.readFileSync(path.join(root, checks[0][1]), 'utf8');
const controller = fs.readFileSync(path.join(root, checks[1][1]), 'utf8');
const ui = fs.readFileSync(path.join(root, checks[3][1]), 'utf8');
const assertions = [
  ['Company-scoped payment query', service.includes('where: { companyId, status: \'PAID\'' )],
  ['Net revenue subtracts refunds', service.includes('p.amount - p.refundedAmount')],
  ['Multi-currency aggregation is guarded', service.includes('Never add different currencies together')],
  ['Three-month forecast is returned', service.includes('length: 3') && service.includes('revenueForecast')],
  ['Customer segmentation is returned', service.includes('customerSegmentation')],
  ['Won-deal product ranking is returned', service.includes("stage: 'WON'") && service.includes('productRecommendations')],
  ['Anomaly z-score and evidence are returned', service.includes('zScore') && service.includes('standard deviations')],
  ['Explainable insight evidence is returned', service.includes('evidence:')],
  ['Authenticated analytics route uses existing guards', controller.includes('UseGuards(JwtAuthGuard, CompanyScopeGuard)') && controller.includes("@Get('predictive')")],
  ['UI renders forecast and data coverage', ui.includes('Revenue forecast') && ui.includes('Data coverage and methodology')],
  ['UI handles errors and retry', ui.includes('query.isError') && ui.includes('query.refetch()')],
];
for (const [label, ok] of assertions) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
console.log(`\n${checks.length + assertions.length - failed}/${checks.length + assertions.length} checks passed.`);
process.exitCode = failed ? 1 : 0;
