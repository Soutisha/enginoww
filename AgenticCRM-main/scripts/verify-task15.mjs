import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const checks = [
  ['visual builder component exists', 'apps/dashboard/src/components/workflows/WorkflowVisualBuilder.tsx'],
  ['workflow detail page integrates builder', 'apps/dashboard/src/app/(dashboard)/workflows/[id]/page.tsx'],
  ['task documentation exists', 'TASK15_VISUAL_AUTOMATION_BUILDER.md'],
];
let failed = 0;
for (const [label, file] of checks) {
  const ok = fs.existsSync(path.join(root, file));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
const builder = fs.readFileSync(path.join(root, checks[0][1]), 'utf8');
const page = fs.readFileSync(path.join(root, checks[1][1]), 'utf8');
const assertions = [
  ['trigger configuration', builder.includes('SCHEDULED') && builder.includes('timezone')],
  ['condition/action/AI/approval/wait node palette', ['condition', 'action', 'ai_agent', 'approval', 'wait'].every((x) => builder.includes(x))],
  ['node reorder and delete controls', builder.includes('move(index') && builder.includes('Trash2')],
  ['validation before save', builder.includes('validation.length > 0')],
  ['existing API persistence integration', page.includes("api.patch(`/workflows/${id}`") && page.includes('<WorkflowVisualBuilder')],
  ['archived workflow read-only', page.includes("readOnly={workflow.status === 'ARCHIVED'}")],
  ['runtime limitations documented', fs.readFileSync(path.join(root, checks[2][1]), 'utf8').includes('updated by Task 16')],
];
for (const [label, ok] of assertions) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`\n${assertions.length + checks.length - failed}/${assertions.length + checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
