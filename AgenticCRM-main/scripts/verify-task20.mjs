import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['Production runtime configuration guard exists', fs.existsSync(path.join(root, 'apps/api/src/common/runtime-config.ts'))],
  ['Production runtime configuration has unit tests', fs.existsSync(path.join(root, 'apps/api/src/common/runtime-config.spec.ts'))],
  ['API readiness endpoint is present', read('apps/api/src/main.ts').includes("expressApp.get('/api/ready'")],
  ['Database readiness check is present', read('apps/api/src/main.ts').includes('prisma.$queryRaw')],
  ['Redis readiness check is present', read('apps/api/src/main.ts').includes('redis.ping()')],
  ['Demo seed is guarded against accidental execution', read('scripts/seed-demo.ts').includes("DEMO_MODE !== 'true'") && read('scripts/seed-demo.ts').includes("NODE_ENV === 'production'")],
  ['Demo seed targets an existing selected tenant', read('scripts/seed-demo.ts').includes('DEMO_COMPANY_SLUG') && read('scripts/seed-demo.ts').includes('findUnique({ where: { slug } })')],
  ['Demo seed creates contacts, leads, products, deals and tasks', ['prisma.contact.upsert', 'prisma.lead.create', 'prisma.product.upsert', 'prisma.deal.create', 'prisma.task.create'].every((s) => read('scripts/seed-demo.ts').includes(s))],
  ['HTTP smoke-test script exists', fs.existsSync(path.join(root, 'scripts/smoke-test.mjs'))],
  ['Security audit script exists', fs.existsSync(path.join(root, 'scripts/security-audit.mjs'))],
  ['Competition runbook exists', fs.existsSync(path.join(root, 'TASK20_TESTING_SECURITY_COMPETITION_READINESS.md'))],
  ['Root package exposes Task 20 commands', ['verify:task20', 'security:audit', 'smoke:test', 'db:seed-demo'].every((s) => read('package.json').includes(s))],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
console.log(`\nTask 20 verification: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);

const audit = spawnSync(process.execPath, ['scripts/security-audit.mjs'], { cwd: root, stdio: 'inherit' });
if (audit.status !== 0) process.exit(audit.status ?? 1);
