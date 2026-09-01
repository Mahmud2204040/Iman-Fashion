// Smoke test for Phase 4 — serves the built bundle and asserts the
// homepage HTML plus the production JS/CSS load without errors.
//
// Run: node scripts/smoke-dashboard.mjs
// Requires `npm run build` to have been run already (dist/ must exist).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const PORT = 4174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

async function serve(pathname) {
  // SPA fallback: routes → /index.html
  let filePath = join(distDir, pathname === '/' ? '/index.html' : pathname);
  if (pathname.startsWith('/assets/')) {
    filePath = join(distDir, pathname);
  } else if (!pathname.includes('.')) {
    filePath = join(distDir, 'index.html');
  }
  try {
    const data = await readFile(filePath);
    return { status: 200, data, type: MIME[extname(filePath)] || 'application/octet-stream' };
  } catch {
    // SPA fallback to index.html for any unknown route
    try {
      const data = await readFile(join(distDir, 'index.html'));
      return { status: 200, data, type: MIME['.html'] };
    } catch {
      return { status: 404, data: Buffer.from('Not found'), type: 'text/plain' };
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { status, data, type } = await serve(url.pathname);
  res.writeHead(status, { 'Content-Type': type });
  res.end(data);
});

await new Promise((r) => server.listen(PORT, r));

async function expect(label, urlPath, asserts) {
  const res = await fetch(`http://localhost:${PORT}${urlPath}`);
  const body = await res.text();
  const ok = asserts.every((a) => a(body, res));
  console.log(`${ok ? '✓' : '✗'} ${label} [${urlPath}] -> ${res.status}`);
  if (!ok) {
    for (const a of asserts) {
      const pass = a(body, res);
      console.log('   ', pass ? 'pass' : 'FAIL', a.toString().slice(0, 80));
    }
  }
  return ok;
}

const results = [];
results.push(
  await expect('index.html served', '/', [
    (b) => b.includes('id="root"'),
    (b) => b.includes('/assets/index-') && b.includes('.js'),
    (b) => b.includes('/assets/index-') && b.includes('.css'),
  ]),
);
results.push(
  await expect('SPA fallback for /dashboard', '/dashboard', [
    (b) => b.includes('id="root"'),
  ]),
);
results.push(
  await expect('SPA fallback for /sales', '/sales', [
    (b) => b.includes('id="root"'),
  ]),
);

// Verify the JS bundle mentions expected dashboard strings
const jsFile = await findJsFile();
results.push(
  await expect('JS bundle mentions dashboard strings', `/assets/${jsFile}`, [
    (b) => b.includes('Today') || b.includes('dashboard') || b.includes('Sales'),
  ]),
);

// Direct unit check on the service module — exercises the actual code
// path that broke before (stats returning an object instead of an array).
{
  const svc = await import('../src/services/dashboard/dashboardService.js');
  const snap = await svc.getDashboardSnapshot('OWNER');
  const ok =
    Array.isArray(snap.stats) &&
    Array.isArray(snap.activity) &&
    Array.isArray(snap.quickActions) &&
    snap.stats.length === 4 &&
    snap.stats.find((s) => s.id === 'today-sales') &&
    snap.stats.find((s) => s.id === 'today-custom-orders') &&
    snap.stats.find((s) => s.id === 'current-cash') &&
    snap.stats.find((s) => s.id === 'total-stock-items');
  console.log(`${ok ? '✓' : '✗'} dashboardService.getDashboardSnapshot shape`);
  if (!ok) console.log('   snapshot:', JSON.stringify(snap, null, 2));
  results.push(ok);
}

server.close();
const allPass = results.every(Boolean);
console.log(allPass ? '\nALL DASHBOARD SMOKE TESTS PASSED' : '\nSOME TESTS FAILED');
process.exit(allPass ? 0 : 1);

async function findJsFile() {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(join(distDir, 'assets'));
  const js = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
  return js;
}