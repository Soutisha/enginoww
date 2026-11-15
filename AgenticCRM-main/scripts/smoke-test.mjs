const api = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const dashboard = process.env.DASHBOARD_URL;
const whatsapp = process.env.WHATSAPP_BASE_URL;
const token = process.env.SMOKE_AUTH_TOKEN;
const results = [];

async function check(label, url, expected, headers = {}) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const ok = expected.includes(response.status);
    results.push({ label, status: response.status, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — HTTP ${response.status}`);
  } catch (error) {
    results.push({ label, status: 'unreachable', ok: false });
    console.log(`FAIL ${label} — ${error instanceof Error ? error.message : error}`);
  }
}

await check('API liveness', `${api}/api/health`, [200]);
await check('API dependency readiness', `${api}/api/ready`, [200]);
await check('Contacts reject anonymous access', `${api}/api/contacts`, [401, 403]);
await check('Leads reject anonymous access', `${api}/api/leads`, [401, 403]);
await check('Products reject anonymous access', `${api}/api/products`, [401, 403]);
if (token) {
  const headers = { Authorization: `Bearer ${token}` };
  await check('Authenticated contacts API responds', `${api}/api/contacts?limit=1`, [200], headers);
  await check('Authenticated leads API responds', `${api}/api/leads?limit=1`, [200], headers);
  await check('Authenticated products API responds', `${api}/api/products?limit=1`, [200], headers);
}
if (dashboard) await check('Dashboard serves its entry page', dashboard, [200]);
if (whatsapp) await check('WhatsApp service health endpoint', `${whatsapp.replace(/\/$/, '')}/health`, [200]);

const failed = results.filter((result) => !result.ok).length;
console.log(`\nSmoke test: ${results.length - failed}/${results.length} checks passed.`);
if (failed) process.exit(1);
