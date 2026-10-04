/** One-time mechanical migration of fixed JSX text into LocalizedText. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const root = path.resolve('src');
const target = path.join(root, 'components', 'common', 'LocalizedText.jsx');
const roots = [path.join(root, 'pages'), path.join(root, 'components', 'domain')];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    return item.isDirectory() ? files(full) : item.name.endsWith('.jsx') ? [full] : [];
  });
}

let changed = 0;
for (const file of roots.flatMap(files)) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('LocalizedText.jsx')) continue;
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const edits = [];
  traverse(ast, {
    JSXText(nodePath) {
      const raw = source.slice(nodePath.node.start, nodePath.node.end);
      if (!/[A-Za-z]/.test(raw.trim())) return;
      if (nodePath.findParent((parent) => parent.isJSXElement() &&
        ['svg', 'text', 'style', 'script'].includes(parent.node.openingElement.name?.name))) return;
      edits.push({ start: nodePath.node.start, end: nodePath.node.end, value: `<T>${raw}</T>` });
    },
  });
  if (!edits.length) continue;
  const relative = path.relative(path.dirname(file), target).replace(/\\/g, '/');
  const importPath = relative.startsWith('.') ? relative : `./${relative}`;
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  }
  output = `import T from '${importPath}';\n${output}`;
  fs.writeFileSync(file, output);
  changed += 1;
}
console.log(`Localized static JSX text in ${changed} files.`);
