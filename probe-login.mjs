// Real HTTP probe of the Vite dev server.
// Fetches /login, renders the JS module graph through Vite, and
// checks whether the HTML shell + module bundle resolve cleanly
// (no 5xx, no transform errors).
const BASE = 'http://localhost:5173';

const checks = [];

async function probe(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return { url, status: res.status, body: await res.text() };
}

const loginPage = await probe(`${BASE}/login`);

checks.push({
  name: '/login HTTP 200',
  pass: loginPage.status === 200,
  detail: `status=${loginPage.status}`,
});

const html = loginPage.body;
checks.push({
  name: '/login HTML has <div id="root">',
  pass: html.includes('id="root"'),
  detail: `len=${html.length}`,
});
checks.push({
  name: '/login HTML loads main.jsx via Vite client',
  pass: html.includes('/src/main.jsx') || html.includes('/@vite/client'),
  detail: 'has main.jsx entry',
});

// Fetch the transformed main.jsx to make sure Vite doesn't 500 on it.
const mainJsx = await probe(`${BASE}/src/main.jsx`);
checks.push({
  name: 'Vite transforms /src/main.jsx (200, no error)',
  pass: mainJsx.status === 200 && !mainJsx.body.startsWith('Internal'),
  detail: `status=${mainJsx.status}, len=${mainJsx.body.length}`,
});

// Walk the import graph a few layers deep.
const importRe = /from\s+["']([^"']+\.(?:jsx?|js))["']/g;
let visited = new Set();
let current = mainJsx.body;
let layer = 0;
while (layer < 4 && current) {
  const next = [];
  let m;
  while ((m = importRe.exec(current)) !== null) {
    const spec = m[1];
    if (!spec.startsWith('/')) continue;
    if (visited.has(spec)) continue;
    next.push(spec);
  }
  layer++;
  for (const url of next) {
    const r = await probe(`${BASE}${url}`);
    visited.add(url);
    checks.push({
      name: `${url} → ${r.status === 200 ? 'OK' : 'FAIL'}`,
      pass: r.status === 200 && !r.body.startsWith('Internal'),
      detail: `${r.status}, ${r.body.length}B`,
    });
    // Only descend into one more layer for the next iteration.
    if (layer === 1) current = r.body;
  }
}

let pass = 0;
let fail = 0;
for (const c of checks) {
  if (c.pass) { pass++; console.log(`OK   ${c.name}`); }
  else { fail++; console.error(`FAIL ${c.name}  →  ${c.detail}`); }
}
console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
