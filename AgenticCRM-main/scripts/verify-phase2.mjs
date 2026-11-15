import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'apps/dashboard/src/app/(dashboard)/inbox/page.tsx',
  'apps/dashboard/src/app/(dashboard)/calls/page.tsx',
  'apps/dashboard/src/app/(dashboard)/storefront/page.tsx',
  'apps/dashboard/src/app/store/[slug]/page.tsx',
  'apps/dashboard/src/components/shell/nav-config.ts',
  'apps/api/src/modules/calls/calls.service.ts',
  'apps/api/src/modules/calls/calls.controller.ts',
  'apps/api/src/modules/calls/calls.module.ts',
  'apps/api/src/modules/conversations/conversations.service.ts',
  'apps/api/src/modules/conversations/conversations.controller.ts',
  'apps/api/src/modules/products/products.controller.ts',
  'apps/api/src/modules/products/products.service.ts',
  'apps/api/src/modules/products/products.module.ts',
  'apps/api/src/modules/company/company.service.ts',
  'apps/api/src/app.module.ts',
];
let failed = false;
for (const file of files) {
  const exists = fs.existsSync(path.join(root, file));
  if (!exists) failed = true;
  console.log(`${exists ? 'PASS' : 'FAIL'} file: ${file}`);
}
const required = [
  ['lead contact tenant validation', 'apps/api/src/modules/leads/leads.service.ts', 'where: { id: dto.contactId, companyId, deletedAt: null }'],
  ['lead list and kanban UI retained', 'apps/dashboard/src/app/(dashboard)/leads/page.tsx', 'LeadKanban'],
  ['lead profile route retained', 'apps/dashboard/src/app/(dashboard)/leads/[id]/page.tsx', 'activities'],
  ['product catalogue retained', 'apps/dashboard/src/app/(dashboard)/products/page.tsx', 'Products'],
  ['inventory adjustment service retained', 'apps/api/src/modules/products/products.service.ts', 'async adjustStock'],
  ['inbox route', 'apps/dashboard/src/app/(dashboard)/inbox/page.tsx', 'WhatsApp Inbox'],
  ['read endpoint', 'apps/api/src/modules/conversations/conversations.controller.ts', "@Post(':id/read')"],
  ['call model', 'packages/database/prisma/schema.prisma', 'model CallRecord {'],
  ['call migration', 'packages/database/prisma/migrations/20261115140000_phase2_call_records/migration.sql', 'CREATE TABLE "CallRecord"'],
  ['calls module registration', 'apps/api/src/app.module.ts', 'CallsModule'],
  ['storefront schema', 'packages/database/prisma/schema.prisma', 'storefrontEnabled Boolean'],
  ['storefront migration', 'packages/database/prisma/migrations/20261115141000_phase2_storefront/migration.sql', 'storefrontEnabled'],
  ['public storefront API', 'apps/api/src/modules/products/products.controller.ts', "@Controller('public/storefront')"],
  ['public storefront page', 'apps/dashboard/src/app/store/[slug]/page.tsx', 'Official catalogue'],
];
for (const [name, file, needle] of required) {
  const ok = fs.readFileSync(path.join(root, file), 'utf8').includes(needle);
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'} acceptance: ${name}`);
}
if (failed) process.exit(1);
console.log('Phase 2 static verification passed. Database and browser integration tests require a configured runtime.');
