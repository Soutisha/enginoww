import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const settings = read('apps/api/src/modules/settings/ai-settings.service.ts');
const settingsController = read('apps/api/src/modules/settings/ai-settings.controller.ts');
const chat = read('apps/api/src/modules/ai-chat/ai-chat.service.ts');
const marketing = read('apps/api/src/modules/marketing/marketing.service.ts');
const vision = read('apps/api/src/modules/product-vision/product-vision.service.ts');
const workerFactory = read('apps/worker/src/agent/providers/provider.factory.ts');
const workerProvider = read('apps/worker/src/agent/providers/openai.provider.ts');
const workerLoop = read('apps/worker/src/agent/agent-loop.ts');
const settingsUi = read('apps/dashboard/src/app/(dashboard)/settings/ai/page.tsx');
const chatUi = read('apps/dashboard/src/app/(dashboard)/chat/page.tsx');
const globalCss = read('apps/dashboard/src/app/globals.css');
const schema = read('packages/database/prisma/schema.prisma');

const providerBlock = settingsUi.match(/const PROVIDERS[\\s\\S]*?= \\[[\\s\\S]*?\\];/)?.[0] ?? '';
const checks = [
  ['New workspaces default to OpenAI + GPT-5.4 mini', schema.includes('@default(OPENAI)') && schema.includes('@default("gpt-5.4-mini")')],
  ['AI service only accepts OPENAI and rejects other providers', settings.includes("dto.provider !== 'OPENAI'") && settings.includes('Only OpenAI')],
  ['AI settings API validates OPENAI only', settingsController.includes("@IsEnum(['OPENAI'])")],
  ['OpenAI API-key test uses the official OpenAI endpoint', settings.includes('https://api.openai.com/v1/chat/completions')],
  ['Admin AI Chat calls OpenAI and dispatches OpenAI tool calls', chat.includes('https://api.openai.com/v1') && chat.includes('callOpenAIWithTools') && chat.includes("provider: 'OPENAI'")],
  ['Admin AI Chat has no Gemini or Anthropic network endpoint', !chat.includes('generativelanguage.googleapis.com') && !chat.includes('api.anthropic.com')],
  ['Marketing Studio calls OpenAI only', marketing.includes('https://api.openai.com/v1/chat/completions') && !marketing.includes('api.anthropic.com') && !marketing.includes('generativelanguage.googleapis.com')],
  ['Product Vision image analysis calls OpenAI only', vision.includes('https://api.openai.com/v1/chat/completions') && !vision.includes('generativelanguage.googleapis.com')],
  ['Background worker factory rejects non-OpenAI providers', workerFactory.includes("config.provider !== 'OPENAI'") && workerFactory.includes('new OpenAiProvider')],
  ['Background worker uses GPT-5 model allowlist and OpenAI keys', workerLoop.includes("const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'") && workerLoop.includes("provider: 'OPENAI'")],
  ['OpenAI provider uses current completion-token parameter', workerProvider.includes('max_completion_tokens') && workerProvider.includes("reasoning_effort: 'none'")],
  ['Settings UI exposes OpenAI as the only provider', providerBlock.includes("value: 'OPENAI'") && (providerBlock.match(/value: '/g) ?? []).length === 1],
  ['Chat composer uses white text on a dark surface', chatUi.includes('bg-gray-900 text-white') && chatUi.includes('placeholder:text-gray-300')],
  ['Global contrast styles enforce white text on dark legacy fields', globalCss.includes('color: #fff !important') && globalCss.includes('caret-color: #fff')],
  ['Legacy worker Gemini and Anthropic provider source files are removed', !exists('apps/worker/src/agent/providers/gemini.provider.ts') && !exists('apps/worker/src/agent/providers/anthropic.provider.ts')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exitCode = 1;
else console.log(`\\n${checks.length}/${checks.length} OpenAI-only and contrast checks passed.`);
