// JSDOM-based render of LoginPage.
// Loads the built CSS Modules-aware module graph by way of Vite SSR.
// Approach: spawn vite preview on the production build, fetch the
// transformed module bundle for /src/main.jsx, evaluate it in a
// JSDOM context. This proves that the React tree actually mounts
// in the DOM without throwing — which is what the user reported
// as "blank page".

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { JSDOM } from 'jsdom';

const BASE = 'http://localhost:5173';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vite = spawn(npmCmd, ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  windowsHide: true,
});

let ready = false;
vite.stdout.on('data', (b) => {
  const s = b.toString();
  if (s.includes('ready in') || s.includes('Local:')) ready = true;
  process.stderr.write('[vite] ' + s);
});
vite.stderr.on('data', (b) => process.stderr.write('[vite:err] ' + b.toString()));

const t0 = Date.now();
while (!ready && Date.now() - t0 < 20000) await wait(200);
if (!ready) { console.error('FAIL: vite not ready'); vite.kill(); process.exit(2); }

// 1. Fetch /login HTML
const html = await fetch(`${BASE}/login`).then((r) => r.text());

// 2. Set up a JSDOM that mirrors what Vite would give the browser
const dom = new JSDOM(html, {
  url: `${BASE}/login`,
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

// Polyfill browser APIs the app expects
window.matchMedia = window.matchMedia || (() => ({
  matches: false, addEventListener: () => {}, removeEventListener: () => {},
}));
window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
window.cancelAnimationFrame = window.cancelAnimationFrame || ((id) => clearTimeout(id));

// 3. Walk every transformed module Vite serves, evaluate them in order
//    inside the JSDOM window context.
const seen = new Set();
const errors = [];

window.addEventListener('error', (e) => errors.push(`window.error: ${e.message}`));

const importRe = /from\s+["']([^"']+)["']/g;
async function evalModule(spec) {
  if (seen.has(spec)) return;
  seen.add(spec);
  const url = spec.startsWith('/') ? `${BASE}${spec}` : spec;
  const r = await fetch(url);
  if (!r.ok) { errors.push(`fetch ${url} → ${r.status}`); return; }
  const code = await r.text();
  // Strip imports — we resolve them by recursing first, then run the body.
  const stripped = code.replace(/import\s+[^;]+?from\s+["'][^"']+["'];?/g, '');
  try {
    window.eval(stripped);
  } catch (e) {
    errors.push(`eval ${spec}: ${e.message}`);
  }
  // Recurse into this module's imports
  let m;
  const re = /from\s+["']([^"']+)["']/g;
  while ((m = re.exec(code)) !== null) {
    const s = m[1];
    if (s.startsWith('/')) await evalModule(s);
  }
}

// Start the chain: Vite's transformed main.jsx
await evalModule('/src/main.jsx');

// Give React a tick to mount
await wait(200);
await wait(200);

const root = window.document.getElementById('root');
const innerLen = root ? root.innerHTML.length : -1;
const innerHTML = root ? root.innerHTML.slice(0, 800) : '';

console.log('--- errors ---');
if (errors.length === 0) console.log('(none)');
else errors.forEach((e) => console.log('  ' + e));
console.log('\n--- #root.innerHTML (first 800 chars) ---');
console.log(innerHTML || '(empty)');
console.log(`\n--- #root child count: ${root ? root.childNodes.length : 'no root'} ---`);
console.log(`--- #root innerHTML length: ${innerLen} ---`);

// Look for LoginPage-specific markers
const hasUsername = innerHTML.includes('Username') || innerHTML.toLowerCase().includes('username');
const hasPassword = innerHTML.includes('Password') || innerHTML.toLowerCase().includes('password');
const hasSignIn   = innerHTML.includes('Sign in') || innerHTML.includes('Log in') || innerHTML.includes('Login');

console.log('\n--- markers ---');
console.log(`  Username label : ${hasUsername}`);
console.log(`  Password label : ${hasPassword}`);
console.log(`  Sign in button : ${hasSignIn}`);

const ok = innerLen > 100 && hasUsername && hasPassword && errors.length === 0;
console.log(`\n${ok ? 'PASS' : 'FAIL'}: LoginPage rendered a real form`);

vite.kill();
await wait(500);
process.exit(ok ? 0 : 1);
