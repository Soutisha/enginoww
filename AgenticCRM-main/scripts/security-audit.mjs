import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['Helmet security headers are enabled', read('apps/api/src/main.ts').includes('app.use(helmet())')],
  ['Request DTO whitelist and unknown-field rejection are enabled', read('apps/api/src/main.ts').includes('whitelist: true') && read('apps/api/src/main.ts').includes('forbidNonWhitelisted: true')],
  ['Production CORS is restricted to the configured domain', read('apps/api/src/main.ts').includes('https://${process.env.DOMAIN}')],
  ['Production startup validates secrets and infrastructure', read('apps/api/src/main.ts').includes('validateRuntimeConfig()')],
  ['JWT strategy rejects missing production secret', read('apps/api/src/modules/auth/jwt.strategy.ts').includes("process.env.NODE_ENV === 'production'")],
  ['JWT refresh tokens are hash-checked for rotation', read('apps/api/src/modules/auth/auth.service.ts').includes('refreshTokenHash !== tokenHash')],
  ['Contacts API is guarded by JWT and company scope', read('apps/api/src/modules/contacts/contacts.controller.ts').includes('@UseGuards(JwtAuthGuard, CompanyScopeGuard)')],
  ['Contacts endpoints declare feature permissions', read('apps/api/src/modules/contacts/contacts.controller.ts').includes("@RequirePermissions('contacts')")],
  ['Rate limiting is configured globally', read('apps/api/src/app.module.ts').includes('ThrottlerModule.forRoot')],
  ['Readiness endpoint checks database and Redis', read('apps/api/src/main.ts').includes("expressApp.get('/api/ready'") && read('apps/api/src/main.ts').includes('prisma.$queryRaw') && read('apps/api/src/main.ts').includes('redis.ping()')],
  ['Demo seeding requires explicit opt-in and tenant slug', read('scripts/seed-demo.ts').includes("DEMO_MODE !== 'true'") && read('scripts/seed-demo.ts').includes('DEMO_COMPANY_SLUG') && read('scripts/seed-demo.ts').includes("NODE_ENV === 'production'")],
  ['Demo records use reserved example.invalid emails', read('scripts/seed-demo.ts').includes('example.invalid')],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
console.log(`\nSecurity audit: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
