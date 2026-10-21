/**
 * Read-only Task 3.8 Backend discovery.
 *
 * Usage: node scripts/probe-task-3-8-api.mjs
 * Optional: API_BASE_URL=https://host/api/v1 node scripts/probe-task-3-8-api.mjs
 *
 * No authorization credentials, POST/PATCH/DELETE requests, or resource writes.
 * Only lists Swagger/OpenAPI route names if a public spec is available.
 * Checks a small number of Staff/Shift GET route candidates; no private data is logged.
 */
const base = (process.env.API_BASE_URL || 'https://pet-clinic-backend-a4lj.onrender.com/api/v1')
  .replace(/\/+$/, '');
const origin = new URL(base).origin;

const candidates = [
  { label: 'API root', url: base },
  { label: 'Swagger UI', url: origin + '/api-docs' },
  { label: 'Swagger UI alternate', url: origin + '/swagger' },
  { label: 'Swagger JSON', url: origin + '/swagger.json' },
  { label: 'OpenAPI JSON', url: origin + '/openapi.json' },
  { label: 'API OpenAPI JSON', url: base + '/openapi.json' },
  { label: 'API docs', url: base + '/docs' },
  { label: 'API health', url: base + '/health' },
  // Route existence checks (GET, unauthenticated, no response data logged).
  // 401/403 suggests authentication gates, NOT proof of a valid endpoint.
  { label: 'Known account users control', url: base + '/admin/users' },
  { label: 'Staff list candidate', url: base + '/admin/staff' },
  { label: 'Staff alternate candidate', url: base + '/staff' },
  { label: 'Staff plural candidate', url: base + '/staffs' },
  { label: 'Employees candidate', url: base + '/admin/employees' },
  { label: 'Shift list candidate', url: base + '/admin/shifts' },
  { label: 'Shift alternate candidate', url: base + '/shifts' },
  { label: 'Schedule candidate', url: base + '/admin/schedules' },
  { label: 'Shift template candidate', url: base + '/admin/shift-templates' },
  { label: 'Shift templates alternate', url: base + '/shift-templates' },
];

function isStaffPath(path) {
  return /staff|shift|schedule|employee|user|branch|auth/i.test(path);
}

async function probe(entry) {
  let response;
  try {
    response = await fetch(entry.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(35000),
      headers: { Accept: 'application/json, text/html;q=0.9, */*;q=0.1' },
    });
  } catch (error) {
    const message = error && typeof error === 'object' && 'cause' in error
      ? String(error.cause?.code || error.cause?.message || error.message)
      : String(error);
    console.log(entry.label + ': NETWORK_ERROR ' + message.slice(0, 160));
    return { networkError: true };
  }

  const kind = response.headers.get('content-type') || '(none)';
  console.log(entry.label + ': HTTP ' + response.status + ' / ' + kind.split(';')[0]);

  if (response.ok && kind.includes('json')) {
    try {
      const json = await response.json();
      const spec = json && typeof json === 'object' && json.paths
        ? json
        : (json && typeof json === 'object' && json.openapi?.paths ? json.openapi : null);
      if (spec) {
        console.log('  OpenAPI version: ' + String(spec.openapi || spec.swagger || 'unknown'));
        const paths = Object.entries(spec.paths || {})
          .filter(([path]) => isStaffPath(path))
          .map(([path, operations]) => {
            const verbs = Object.keys(operations).filter(verb =>
              ['get', 'post', 'put', 'patch', 'delete'].includes(verb));
            return '  ' + verbs.join(', ').toUpperCase() + ' ' + path;
          });
        console.log('  Documented relevant operations (' + paths.length + '):');
        for (const route of paths.slice(0, 100)) console.log(route);
      } else {
        // Never print API data or response bodies: they may contain private records.
        console.log('  JSON response, not a recognizable OpenAPI specification.');
      }
    } catch {
      console.log('  Response body not parseable as JSON.');
    }
  } else if (response.ok && kind.includes('html')) {
    console.log('  HTML is available; API schema not automatically derivable from this response.');
    await response.body?.cancel();
  } else {
    await response.body?.cancel();
  }
  return { status: response.status };
}

console.log('Read-only public API documentation discovery, no authentication.');
console.log('Target host: ' + new URL(origin).host);
const results = [];
for (const entry of candidates) results.push(await probe(entry));
if (results.every(result => result?.status === 503)) {
  console.error('BLOCKED: all public endpoints return HTTP 503; request BE to restore Render before API integration.');
  process.exitCode = 2;
} else if (results[0]?.networkError || results[0]?.status === 503) {
  console.error('BLOCKED: API root is unreachable; investigate the Render deployment.');
  process.exitCode = 2;
}
console.log('Done. HTTP 401/403/404 alone does NOT prove that a Staff/Shift API exists.');
