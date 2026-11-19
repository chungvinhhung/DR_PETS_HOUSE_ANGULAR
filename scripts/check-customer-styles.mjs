#!/usr/bin/env node
// Keep component styles attached: Angular builds can pass even when a
// component silently forgets its matching .scss file.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = [
  'src/app/features/customer',
  'src/app/layouts/customer',
  'src/app/shared/customer',
];
const missing = [];
let checked = 0;

function visit(dir) {
  if (!existsSync(dir)) return;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) {
      visit(file);
      continue;
    }
    if (!item.name.endsWith('.component.ts')) continue;
    const scss = file.replace(/\.ts$/, '.scss');
    const css = file.replace(/\.ts$/, '.css');
    if (!existsSync(scss) && !existsSync(css)) continue;
    checked += 1;

    const source = readFileSync(file, 'utf8');
    const start = source.indexOf('@Component({');
    const end = source.indexOf('export class ', start);
    const decorator = start >= 0 ? source.slice(start, end > start ? end : start + 3000) : '';
    if (!/\bstyleUrls?\s*:/.test(decorator)) {
      missing.push(relative('.', file));
    }
  }
}
for (const root of roots) visit(root);
if (missing.length) {
  console.error('Customer components have a matching stylesheet but no styleUrl/stylesUrls:');
  for (const file of missing) console.error(' - ' + file);
  process.exitCode = 1;
} else {
  console.log('Customer component styles OK (' + checked + ' components checked).');
}
