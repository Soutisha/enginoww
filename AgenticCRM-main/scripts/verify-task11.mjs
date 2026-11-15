import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'apps/api/src/modules/memory/document-parser.ts',
  'apps/api/src/modules/memory/memory.controller.ts',
  'apps/api/src/modules/memory/memory.service.ts',
  'apps/api/src/modules/memory/business-doc-access.ts',
  'apps/api/src/modules/ai-chat/ai-chat.controller.ts',
  'apps/dashboard/src/app/(dashboard)/knowledge/page.tsx',
  'packages/database/prisma/migrations/20261115193000_rag_business_brain/migration.sql',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Task 11 file: ${file}`);
}
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['document upload endpoint', read(required[1]).includes("business-documents/upload")],
  ['document deletion endpoint', read(required[1]).includes('deleteBusinessDocument')],
  ['hybrid retrieval and centralized ACL', read(required[2]).includes('searchWithStatus') && read(required[2]).includes('canAccessBusinessDocument') && read(required[3]).includes('allowedUserIds.includes')],
  ['legacy memory API isolation', read(required[2]).includes("chunk.source === 'business-doc' && !opts.includeBusinessDocs") && read(required[2]).includes("source: { not: 'business-doc' }")],
  ['RAG answer endpoint', read(required[4]).includes("Post('knowledge')")],
  ['source citation prompt', read(required[4]).includes('Cite every factual claim')],
  ['frontend Business Brain page', read(required[5]).includes('RAG Business Brain')],
  ['pgvector metadata migration', read(required[6]).includes('"allowedUserIds"')],
];
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) process.exitCode = 1;
}
if (!process.exitCode) console.log('Task 11 static verification passed.');
