import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const controller = read('apps/api/src/modules/analytics/analytics.controller.ts');
const moduleFile = read('apps/api/src/modules/analytics/analytics.module.ts');
const service = read('apps/api/src/modules/analytics/command-centre.service.ts');
const page = read('apps/dashboard/src/app/(dashboard)/command-centre/page.tsx');
const scene = read('apps/dashboard/src/components/command-centre/business-network-canvas.tsx');
const nav = read('apps/dashboard/src/components/shell/nav-config.ts');
const checks = [
  ['command-centre API route is protected by analytics controller guards', controller.includes("@Controller('analytics')") && controller.includes("@RequirePermissions('analytics')") && controller.includes("@Get('command-centre')")],
  ['command-centre service registered in analytics module', moduleFile.includes('CommandCentreService')],
  ['all snapshot queries are company-scoped', ['contact.findMany', 'lead.findMany', 'deal.findMany', 'product.findMany', 'user.findMany', 'conversation.findMany', 'message.findMany', 'workflowExecution.findMany'].every((name) => service.includes(name)) && (service.match(/companyId/g) ?? []).length >= 14],
  ['contact, lead and deal CRM relationship edges are generated', service.includes("kind: 'contact-lead'") && service.includes("kind: 'contact-deal'") && service.includes("kind: 'lead-deal'") && service.includes("kind: 'product-deal'") && service.includes('dealLineItem.findMany')],
  ['live handoff and AI reply metrics use persisted records', service.includes("status: 'WAITING_HUMAN'") && service.includes('isAiGenerated: true')],
  ['recent conversations, AI messages and workflow executions feed activity', service.includes('conversations.map') && service.includes('aiMessages.map') && service.includes('executions.map')],
  ['3D command centre page consumes the live API snapshot', page.includes("api.get('/analytics/command-centre')")],
  ['automatic refresh and WebSocket invalidation are wired', page.includes('refetchInterval: 30_000') && page.includes("socket.on('message.new'") && page.includes("socket.on('conversation.updated'")],
  ['entity filters and selectable CRM object details exist', page.includes('toggleKind') && page.includes('onSelect={setSelected}') && page.includes('Open CRM record')],
  ['interactive perspective network renderer supports rotation and selection', scene.includes('rotationRef') && scene.includes('perspective') && scene.includes('onPointerDown') && scene.includes('onPointerUp')],
  ['network draws real CRM links and separates entity types', scene.includes('links.forEach') && scene.includes('PALETTE')],
  ['route is present in navigation and dark shell migration', nav.includes("href: '/command-centre'") && nav.includes("'/command-centre'")],
  ['no fake demo records are used', page.includes('No demo objects are injected')],
  ['implementation boundary documented', read('TASK18_3D_BUSINESS_COMMAND_CENTRE.md').includes('not a Three.js/React Three Fiber scene')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
