import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dictionary = readFileSync('src/contexts/LocaleContext.jsx', 'utf8');
const translated = new Set([...dictionary.matchAll(/'([^']+)':\s*'[^']*'/g)].map((match) => match[1]));

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

const missing = new Set();
for (const file of filesIn('src/services')) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/new Error\(\s*'([^']+)'\s*\)/g)) {
    if (!translated.has(match[1])) missing.add(match[1]);
  }
}
for (const message of [...missing].sort()) console.log(message);
console.log(`\n${missing.size} untranslated static service errors.`);
