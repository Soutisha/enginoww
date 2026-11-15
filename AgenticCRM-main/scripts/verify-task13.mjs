import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'apps/api/src/modules/marketing/marketing.module.ts',
  'apps/api/src/modules/marketing/marketing.controller.ts',
  'apps/api/src/modules/marketing/marketing.service.ts',
  'apps/dashboard/src/app/(dashboard)/marketing/page.tsx',
  'packages/database/prisma/migrations/20261115210000_task13_generative_marketing/migration.sql',
  'apps/api/src/modules/marketing/__tests__/marketing.service.spec.ts',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Task 13 file: ${file}`);
}
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const service = read(required[2]);
const controller = read(required[1]);
const page = read(required[3]);
const schema = read('packages/database/prisma/schema.prisma');
const app = read('apps/api/src/app.module.ts');
const nav = read('apps/dashboard/src/components/shell/nav-config.ts');
const checks = [
  ['Marketing module registered', app.includes('MarketingModule')],
  ['Company-scoped protected API', controller.includes('CompanyScopeGuard') && controller.includes("RequirePermissions('products')")],
  ['Six requested marketing generators', ['product_description','whatsapp_reply','promotional_copy','campaign','social_post','banner'].every(x => service.includes(x))],
  ['Configured AI provider and encrypted key reused', service.includes('prisma.aiConfig.findUnique') && service.includes('decrypt(config.apiKeyEncrypted)')],
  ['OpenAI-only marketing generation path', service.includes('https://api.openai.com/v1/chat/completions') && service.includes("provider: 'OPENAI'") && !service.includes('api.anthropic.com')],
  ['Product facts are scoped to the company', service.includes('where: { id: input.productId, companyId }')],
  ['Brand voice and avoid-term checks', service.includes('checkBrandConsistency') && service.includes('avoidTerms')],
  ['Generated content saved as drafts', service.includes('prisma.marketingAsset.create') && "status: 'DRAFT'" ],
  ['Campaign drafts can be handed to campaign module', page.includes("api.post('/campaigns'")],
  ['SVG banner export is available', page.includes('image/svg+xml') && page.includes('Download SVG banner')],
  ['Marketing Studio appears in navigation', nav.includes("href: '/marketing'")],
  ['Prisma schema includes draft persistence', schema.includes('model MarketingAsset') && schema.includes('model MarketingBrandProfile')],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exitCode = 1;
else console.log(`\n${checks.length}/${checks.length} Task 13 static checks passed.`);
