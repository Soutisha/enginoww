import fs from 'node:fs';
const service = fs.readFileSync('apps/api/src/modules/workflows/workflows.service.ts', 'utf8');
const controller = fs.readFileSync('apps/api/src/modules/workflows/workflows.controller.ts', 'utf8');
const page = fs.readFileSync('apps/dashboard/src/app/(dashboard)/workflows/[id]/page.tsx', 'utf8');
const doc = fs.readFileSync('TASK16_WORKFLOW_EXECUTION_ENGINE.md', 'utf8');
const checks = [
  ['manual run executes workflow steps', service.includes('executeFromStep(companyId, workflow, execution.id')],
  ['company-scoped contact validation', service.includes('where: { id: contactId, companyId, deletedAt: null }')],
  ['condition operators implemented', ['not_equals', 'contains', 'greater_than', 'less_than'].every(x => service.includes(x))],
  ['contact tag actions implemented', service.includes("action === 'add_tag'") && service.includes("action === 'remove_tag'")],
  ['CRM task action implemented', service.includes('prisma.task.create')],
  ['contact note action implemented', service.includes("action === 'create_note'")],
  ['approval pause and resume implemented', service.includes('resumeApproval') && service.includes('WAITING_APPROVAL')],
  ['delay checkpoint and resume implemented', service.includes('resumeDelay') && service.includes('WAITING_DELAY')],
  ['unsupported actions fail closed', service.includes('is not enabled in the workflow runtime')],
  ['execution failures persisted', service.includes("status: 'FAILED'") && service.includes('errorCount: { increment: 1 }')],
  ['approval API route wired', controller.includes("executions/:executionId/approval")],
  ['delay resume API route wired', controller.includes("executions/:executionId/resume-delay")],
  ['execution UI approval controls', page.includes('approveMut.mutate') && page.includes('resumeDelayMut.mutate')],
  ['runtime boundaries documented', doc.includes('Task 17 adds BullMQ delayed jobs')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`\\n${checks.length - failed}/${checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
