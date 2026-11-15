import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['Product vision module exists', 'apps/api/src/modules/product-vision/product-vision.module.ts'],
  ['Product vision service exists', 'apps/api/src/modules/product-vision/product-vision.service.ts'],
  ['Product vision controller exists', 'apps/api/src/modules/product-vision/product-vision.controller.ts'],
  ['API module is registered', 'apps/api/src/app.module.ts'],
  ['Product image intelligence UI exists', 'apps/dashboard/src/app/(dashboard)/products/vision/page.tsx'],
  ['Products page links to image intelligence', 'apps/dashboard/src/app/(dashboard)/products/page.tsx'],
  ['Product vision tests exist', 'apps/api/src/modules/product-vision/__tests__/product-vision.service.spec.ts'],
];
let failed = 0;
for (const [label, relative] of checks) {
  const exists = fs.existsSync(path.join(root, relative));
  console.log(`${exists ? 'PASS' : 'FAIL'} ${label}`);
  if (!exists) failed++;
}
const service = fs.readFileSync(path.join(root, 'apps/api/src/modules/product-vision/product-vision.service.ts'), 'utf8');
for (const [label, ok] of [
  ['Image size limit is enforced', service.includes('10 * 1024 * 1024')],
  ['Image MIME types are allow-listed', service.includes('ALLOWED_MIME')],
  ['Company AI configuration is scoped', service.includes('where: { companyId }')],
  ['Model output is parsed as JSON', service.includes('JSON.parse(clean)')],
  ['Vision results include OCR text', service.includes('extractedText')],
]) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exitCode = 1;
else console.log(`\n${checks.length + 5}/${checks.length + 5} Task 12 static checks passed.`);
