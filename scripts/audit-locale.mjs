/** Show untranslated fixed JSX text in the page and dashboard components. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const root = path.resolve('src');
const roots = [path.join(root, 'pages'), path.join(root, 'components', 'domain')];
const catalog = fs.readFileSync(path.join(root, 'contexts', 'LocaleContext.jsx'), 'utf8');
const keys = new Set([...catalog.matchAll(/'((?:\\'|[^'])+)':\s*'/g)].map((match) => match[1]));
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : entry.name.endsWith('.jsx') ? [full] : [];
  });
}
const strings = new Map();
const props = new Map();
const expressions = new Map();
const translatedAttributes = new Set(['label', 'placeholder', 'title', 'subtitle', 'description', 'eyebrow', 'hint', 'helper', 'emptyTitle', 'emptyLabel', 'confirmText', 'cancelText', 'loadingText', 'message', 'aria-label']);
for (const file of roots.flatMap(files)) {
  const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  traverse(ast, {
    JSXElement(nodePath) {
      if (nodePath.node.openingElement.name.name !== 'T') return;
      const value = nodePath.node.children.filter((child) => child.type === 'JSXText')
        .map((child) => child.value).join('').trim().replace(/\s+/g, ' ');
      if (!value || keys.has(value)) return;
      strings.set(value, (strings.get(value) || 0) + 1);
    },
    JSXAttribute(nodePath) {
      const name = nodePath.node.name.name;
      if (!translatedAttributes.has(name)) return;
      const value = nodePath.node.value?.value;
      if (typeof value !== 'string' || !/[A-Za-z]/.test(value) || keys.has(value)) return;
      props.set(value, (props.get(value) || 0) + 1);
    },
    JSXExpressionContainer(nodePath) {
      const parent = nodePath.parentPath;
      if (!parent?.isJSXElement()) return;
      const expression = nodePath.node.expression;
      const values = expression.type === 'StringLiteral' ? [expression.value]
        : expression.type === 'ConditionalExpression' &&
          expression.consequent.type === 'StringLiteral' && expression.alternate.type === 'StringLiteral'
          ? [expression.consequent.value, expression.alternate.value] : [];
      for (const value of values) {
        if (!value || !/[A-Za-z]/.test(value) || keys.has(value)) continue;
        expressions.set(value, (expressions.get(value) || 0) + 1);
      }
    },
  });
}
for (const [value, count] of [...strings.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(3)}  ${value}`);
}
console.log(`${strings.size} untranslated static JSX strings.`);
console.log('\nUntranslated static props:');
for (const [value, count] of [...props.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(3)}  ${value}`);
}
console.log(`${props.size} untranslated static JSX props.`);
console.log('\nUntranslated static JSX expressions:');
for (const [value, count] of [...expressions.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(3)}  ${value}`);
}
console.log(`${expressions.size} untranslated static JSX expressions.`);
