// Self-contained E2E: spawn vite dev server, wait until ready,
// probe /login + module graph, then shut down.
// Runs in its own Node process — does not require the user's
// PowerShell terminal to be responsive.

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://localhost:5173';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vite = spawn(npmCmd, ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  windowsHide: true,
});

let serverReady = false;
vite.stdout.on('data', (b) => {
  const s = b.toString();
  if (s.includes('ready in') || s.includes('Local:')) serverReady = true;
  process.stderr.write('[vite] ' + s);
});
vite.stderr.on('data', (b) => process.stderr.write('[vite:err] ' + b.toString()));
vite.on('exit', (code) => process.stderr.write(`[vite] exited ${code}\n`));

// Wait up to 20s for "ready in"
const start = Date.now();
while (!serverReady && Date.now() - start < 20000) await wait(200);
if (!serverReady) {
  console.error('FAIL: vite never reported ready');
  vite.kill();
  process.exit(2);
}

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(pass ? `OK   ${name}` : `FAIL ${name}${detail ? '  →  ' + detail : ''}`);
}

async function probe(url, opts = {}) {
  try {
    const r = await fetch(url, { redirect: opts.redirect ?? 'follow' });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    return { status: -1, body: '', err: e.message };
  }
}

const login = await probe(`${BASE}/login`);
check('/login HTTP 200', login.status === 200, `status=${login.status}`);
check(
  '/login HTML has <div id="root">',
  login.body.includes('id="root"'),
  `len=${login.body.length}`,
);
check(
  '/login HTML loads main.jsx via Vite client',
  login.body.includes('/src/main.jsx') || login.body.includes('/@vite/client'),
);

const main = await probe(`${BASE}/src/main.jsx`);
check(
  'Vite transforms /src/main.jsx (200, no error)',
  main.status === 200 && !main.body.startsWith('Internal'),
  `status=${main.status}, len=${main.body.length}`,
);

// Walk imports up to 2 layers deep
const visited = new Set();
let current = main.body;
for (let layer = 0; layer < 2 && current; layer++) {
  const importRe = /from\s+["']([^"']+\.(?:jsx?|js))["']/g;
  const specs = [];
  let m;
  while ((m = importRe.exec(current)) !== null) {
    const spec = m[1];
    if (spec.startsWith('/') && !visited.has(spec)) specs.push(spec);
  }
  for (const u of specs) {
    visited.add(u);
    const r = await probe(`${BASE}${u}`);
    const ok = r.status === 200 && !r.body.startsWith('Internal');
    check(
      `${u} → ${ok ? 'OK' : 'FAIL'}`,
      ok,
      `${r.status}, ${r.body.length}B`,
    );
    if (layer === 0) current = r.body;
  }
}

const pass = results.filter((r) => r.pass).length;
const fail = results.length - pass;
console.log(`\n${pass} passed, ${fail} failed.`);

vite.kill();
await wait(500);
process.exit(fail === 0 ? 0 : 1);
